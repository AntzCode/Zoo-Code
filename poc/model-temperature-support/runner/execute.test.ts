import assert from "node:assert/strict"
import test from "node:test"

import { executeMatrix } from "./execute.js"
import { models } from "./models.js"
import { providers } from "./providers.js"
import type { RunSelection, RunStore } from "./results.js"
import type { AttemptRecord, PromptCase } from "./types.js"

const provider = providers[0]!
const model = models.find(({ id }) => id === "gpt-6-luna")!
const promptCase: PromptCase = {
	id: "arithmetic-answer",
	name: "Correct arithmetic answer",
	prompt: "Calculate 17 multiplied by 19. Reply exactly ANSWER: 323.",
	maxOutputTokens: 1024,
	usefulResponse: { type: "regex", pattern: "^ANSWER:\\s*323[.!]?$", flags: "i" },
}

function makeSelection(overrides: Partial<RunSelection> = {}): RunSelection {
	return {
		provider,
		models: [model],
		effortsByModel: new Map([[model.id, ["medium"]]]),
		temperatures: [0, 1],
		promptCases: [promptCase],
		topPCompatibility: false,
		...overrides,
	}
}

function makeStore(attempts: AttemptRecord[]): RunStore {
	return {
		runId: "run-test",
		runDirectory: "/tmp/run-test",
		readAttempts: () => attempts,
		appendAttempt: async (attempt) => {
			attempts.push(attempt)
		},
		addAttemptNote: async (attempt) => {
			attempts.push(attempt)
		},
		appendLog: async () => {},
		finish: async () => {},
	}
}

test("matrix records each selected condition once and continues after a failed request", async () => {
	const attempts: AttemptRecord[] = []
	const requests: Array<Record<string, unknown>> = []
	const sessionIds: string[] = []
	let callIndex = 0
	const failedAttempts = await executeMatrix({
		selection: makeSelection(),
		store: makeStore(attempts),
		apiKey: "unit-test-key",
		delayMs: 0,
		fetchImpl: async (_input, init) => {
			requests.push(JSON.parse(String(init?.body)) as Record<string, unknown>)
			sessionIds.push(new Headers(init?.headers).get(provider.sessionHeader) ?? "")
			callIndex += 1
			return callIndex === 2
				? new Response(JSON.stringify({ error: { message: "temperature rejected" } }), {
						status: 400,
						statusText: "Bad Request",
					})
				: new Response(JSON.stringify({ output_text: "ANSWER: 323" }), { status: 200 })
		},
	})

	assert.equal(requests.length, 3)
	assert.equal(new Set(sessionIds).size, requests.length)
	assert.deepEqual(
		sessionIds,
		attempts.map(({ attemptId }) => attemptId),
	)
	assert.equal("temperature" in requests[0]!, false)
	assert.equal(requests[1]?.temperature, 0)
	assert.equal(requests[2]?.temperature, 1)
	assert.equal(failedAttempts.length, 1)
	assert.equal(failedAttempts[0]?.httpStatus, 400)
	assert.deepEqual(
		attempts.map(({ attemptNumber }) => attemptNumber),
		[1, 1, 1],
	)
	assert.deepEqual(
		attempts.map(({ usefulResponse }) => usefulResponse),
		[true, false, true],
	)
})

test("waits between sent requests but not before the first request", async () => {
	const attempts: AttemptRecord[] = []
	const events: string[] = []
	let requestCount = 0
	const failedAttempts = await executeMatrix({
		selection: makeSelection({ temperatures: [0, 1] }),
		store: makeStore(attempts),
		apiKey: "unit-test-key",
		delayMs: 250,
		sleep: async (milliseconds) => {
			events.push(`sleep:${milliseconds}`)
		},
		fetchImpl: async () => {
			requestCount += 1
			events.push(`request:${requestCount}`)
			return new Response(JSON.stringify({ output_text: "ANSWER: 323" }), { status: 200 })
		},
	})

	assert.deepEqual(events, ["request:1", "sleep:250", "request:2", "sleep:250", "request:3"])
	assert.equal(attempts.length, 3)
	assert.deepEqual(failedAttempts, [])
})

test("documented top_p restriction is recorded without sending a request", async () => {
	const attempts: AttemptRecord[] = []
	const sleeps: number[] = []
	let fetchCalls = 0
	const failed = await executeMatrix({
		selection: makeSelection({
			effortsByModel: new Map([[model.id, ["medium"]]]),
			temperatures: [1],
			topPCompatibility: true,
		}),
		store: makeStore(attempts),
		apiKey: "unit-test-key",
		delayMs: 250,
		sleep: async (milliseconds) => {
			sleeps.push(milliseconds)
		},
		fetchImpl: async () => {
			fetchCalls += 1
			return new Response(JSON.stringify({ output_text: "ANSWER: 323" }), { status: 200 })
		},
	})

	assert.equal(fetchCalls, 2)
	assert.deepEqual(sleeps, [250])
	assert.equal(attempts.length, 3)
	assert.equal(attempts[2]?.probeKind, "top-p-compatibility")
	assert.equal(attempts[2]?.executionStatus, "not_run_documented")
	assert.equal(attempts[2]?.attemptNumber, null)
	assert.match(attempts[2]?.error ?? "", /omit temperature and top_p/)
	assert.equal(failed.length, 0)
})

test("a rejected temperature/top_p pair triggers a top_p-only diagnostic request", async () => {
	const attempts: AttemptRecord[] = []
	const requests: Array<Record<string, unknown>> = []
	const sessionIds: string[] = []
	const grok = models.find(({ id }) => id === "grok-4.6")!
	const sleeps: number[] = []
	let callIndex = 0
	const failed = await executeMatrix({
		selection: makeSelection({
			models: [grok],
			effortsByModel: new Map([[grok.id, ["low"]]]),
			temperatures: [1],
			topPCompatibility: true,
		}),
		store: makeStore(attempts),
		apiKey: "unit-test-key",
		delayMs: 250,
		sleep: async (milliseconds) => {
			sleeps.push(milliseconds)
		},
		fetchImpl: async (_input, init) => {
			requests.push(JSON.parse(String(init?.body)) as Record<string, unknown>)
			sessionIds.push(new Headers(init?.headers).get(provider.sessionHeader) ?? "")
			callIndex += 1
			return callIndex === 3
				? new Response(JSON.stringify({ error: { message: "temperature and top_p cannot be set together" } }), {
						status: 400,
						statusText: "Bad Request",
					})
				: new Response(JSON.stringify({ output_text: "ANSWER: 323" }), { status: 200 })
		},
	})

	assert.equal(requests.length, 4)
	assert.deepEqual(sleeps, [250, 250, 250])
	assert.equal(new Set(sessionIds).size, requests.length)
	assert.deepEqual(
		sessionIds,
		attempts.map(({ attemptId }) => attemptId),
	)
	assert.equal(requests[2]?.temperature, 1)
	assert.equal(requests[2]?.top_p, 0.95)
	assert.equal("temperature" in requests[3]!, false)
	assert.equal(requests[3]?.top_p, 0.95)
	assert.deepEqual(
		attempts.map(({ probeKind }) => probeKind),
		["baseline", "temperature", "top-p-compatibility", "top-p-diagnostic"],
	)
	assert.equal(failed.length, 1)
})
