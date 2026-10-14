import assert from "node:assert/strict"
import test from "node:test"

import { models } from "./models.js"
import { providers } from "./providers.js"
import { createResponsesBody, executeResponsesRequest, isUsefulResponse, makeRawHttpTranscript } from "./request.js"
import type { PromptCase } from "./types.js"

const provider = providers[0]!
const model = models[0]!
const promptCase: PromptCase = {
	id: "arithmetic-answer",
	name: "Correct arithmetic answer",
	prompt: "Calculate 17 multiplied by 19. Reply exactly ANSWER: 323.",
	maxOutputTokens: 1024,
	usefulResponse: { type: "regex", pattern: "^ANSWER:\\s*323[.!]?$", flags: "i" },
}

test("request body includes selected parameters and omits unset sampling controls", () => {
	const baseline = createResponsesBody(model, promptCase, "none", {})
	assert.equal("temperature" in baseline, false)
	assert.equal("top_p" in baseline, false)

	const explicit = createResponsesBody(model, promptCase, "none", { temperature: 0.5, topP: 0.95 })
	assert.equal(explicit.temperature, 0.5)
	assert.equal(explicit.top_p, 0.95)
})

test("regex useful-response rule accepts matching answer and rejects empty or mismatched text", () => {
	assert.equal(isUsefulResponse(promptCase, "ANSWER: 323"), true)
	assert.equal(isUsefulResponse(promptCase, "ANSWER: 324"), false)
	assert.equal(isUsefulResponse(promptCase, "  "), false)
})

test("non-empty-text rule accepts arbitrary non-empty responses and rejects whitespace", () => {
	const openEndedCase: PromptCase = {
		...promptCase,
		usefulResponse: { type: "non-empty-text" },
	}
	assert.equal(isUsefulResponse(openEndedCase, "A blue glass seed that hums at dawn."), true)
	assert.equal(isUsefulResponse(openEndedCase, "A very different idea."), true)
	assert.equal(isUsefulResponse(openEndedCase, " \n\t "), false)
})

test("direct Responses request captures status, response time, and redacts the credential", async () => {
	const secret = "test-secret-token"
	let requestUrl = ""
	let requestHeaders: Headers | undefined
	let requestBody = ""
	let monotonicNowCall = 0
	const monotonicTimes = [100, 347.5]
	const result = await executeResponsesRequest({
		provider,
		model,
		promptCase,
		effort: "none",
		condition: { temperature: 1 },
		probeKind: "temperature",
		apiKey: secret,
		attemptNumber: 1,
		clock: () => new Date("2026-10-13T12:00:00.000Z"),
		monotonicNow: () => monotonicTimes[monotonicNowCall++]!,
		fetchImpl: async (input, init) => {
			requestUrl = String(input)
			requestHeaders = new Headers(init?.headers)
			requestBody = String(init?.body)
			return new Response(JSON.stringify({ output_text: "ANSWER: 323" }), {
				status: 200,
				headers: { "content-type": "application/json" },
			})
		},
	})

	assert.equal(requestUrl, "https://opencode.ai/zen/go/v1/responses")
	assert.equal(requestHeaders?.get("authorization"), `Bearer ${secret}`)
	assert.equal(requestHeaders?.get(provider.sessionHeader), result.record.attemptId)
	assert.equal(JSON.parse(requestBody).temperature, 1)
	assert.equal(result.record.httpStatus, 200)
	assert.equal(result.record.responseTimeMs, 247.5)
	assert.equal(result.record.usefulResponse, true)
	assert.equal(result.record.executionStatus, "completed")
	assert.match(result.rawHttp, /Bearer <REDACTED_API_TOKEN>/)
	assert.doesNotMatch(result.rawHttp, new RegExp(secret))
	assert.doesNotMatch(JSON.stringify(result.record), new RegExp(secret))
})

test("raw HTTP transcript redacts a credential wherever it appears", () => {
	const secret = "test-api-key-fixture"
	const transcript = makeRawHttpTranscript({
		url: new URL("https://example.test/v1/responses"),
		requestHeaders: new Headers({ authorization: `Bearer ${secret}` }),
		requestBody: JSON.stringify({ model: "demo", accidental: secret }),
		responseStatus: 400,
		responseStatusText: "Bad Request",
		responseHeaders: new Headers({ "content-type": "application/json" }),
		responseBody: JSON.stringify({ error: { message: `Rejected ${secret}` } }),
		secret,
	})

	assert.equal(transcript.includes(secret), false)
	assert.equal(transcript.match(/<REDACTED_API_TOKEN>/g)?.length, 3)
})

test("non-success HTTP responses are recorded with response time", async () => {
	let monotonicNowCall = 0
	const monotonicTimes = [500, 735]
	const result = await executeResponsesRequest({
		provider,
		model,
		promptCase,
		effort: "medium",
		condition: { temperature: 1 },
		probeKind: "temperature",
		apiKey: "test-secret-token",
		attemptNumber: 1,
		monotonicNow: () => monotonicTimes[monotonicNowCall++]!,
		fetchImpl: async () =>
			new Response(JSON.stringify({ error: { message: "Unsupported temperature" } }), {
				status: 400,
				statusText: "Bad Request",
				headers: { "content-type": "application/json" },
			}),
	})

	assert.equal(result.record.httpStatus, 400)
	assert.equal(result.record.responseTimeMs, 235)
	assert.equal(result.record.usefulResponse, false)
	assert.equal(result.record.executionStatus, "http_error")
	assert.equal(result.record.error, "Unsupported temperature")
})

test("network failures still record elapsed response time", async () => {
	let monotonicNowCall = 0
	const monotonicTimes = [1000, 1240.25]
	const result = await executeResponsesRequest({
		provider,
		model,
		promptCase,
		effort: "medium",
		condition: {},
		probeKind: "baseline",
		apiKey: "test-secret-token",
		attemptNumber: 1,
		monotonicNow: () => monotonicTimes[monotonicNowCall++]!,
		fetchImpl: async () => {
			throw new Error("Connection failed")
		},
	})

	assert.equal(result.record.executionStatus, "network_error")
	assert.equal(result.record.responseTimeMs, 240.25)
})
