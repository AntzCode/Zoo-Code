import assert from "node:assert/strict"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"

import { createRunStore } from "./results.js"
import { models } from "./models.js"
import { providers } from "./providers.js"
import type { AttemptRecord, PromptCase } from "./types.js"

const provider = providers[0]!
const model = models[0]!
const promptCase: PromptCase = {
	id: "small-check",
	name: "Small check",
	prompt: "Return the requested marker.",
	maxOutputTokens: 128,
	usefulResponse: { type: "regex", pattern: "^OK$" },
}

test("run store writes manifest, normalized CSV, and raw HTTP without credentials", async () => {
	const temporaryRoot = await mkdtemp(join(tmpdir(), "model-temperature-support-"))
	try {
		const store = await createRunStore(
			{
				provider,
				models: [model],
				effortsByModel: new Map([[model.id, ["medium"]]]),
				temperatures: [1],
				promptCases: [promptCase],
				topPCompatibility: false,
			},
			() => new Date("2026-10-13T12:00:00.000Z"),
			temporaryRoot,
		)
		const secret = "test-api-key-fixture"
		const attempt: AttemptRecord = {
			attemptId: "test-attempt",
			attemptNumber: 1,
			timestamp: "2026-10-13T12:00:00.000Z",
			responseTimeMs: 245.7,
			providerId: provider.id,
			modelId: model.id,
			apiFormat: provider.apiFormat,
			caseId: promptCase.id,
			caseName: promptCase.name,
			reasoningEffort: "medium",
			temperature: 1,
			topP: null,
			probeKind: "temperature",
			executionStatus: "completed",
			httpStatus: 200,
			usefulResponse: true,
			error: null,
			rawHttpFile: "http/test-attempt.http",
		}
		await store.appendAttempt(attempt, `Authorization: Bearer <REDACTED_API_TOKEN>\r\n\r\nReply`)
		await store.appendLog("Run started")
		await store.appendLog("temperature: gpt-5.6-luna — HTTP 200, useful: Yes")
		const manifestPath = join(store.runDirectory, "manifest.json")
		const manifestBeforeFinish = await readFile(manifestPath, "utf8")
		const outcomes = await readFile(join(store.runDirectory, "outcomes.csv"), "utf8")
		const rawHttp = await readFile(join(store.runDirectory, attempt.rawHttpFile), "utf8")
		const runnerLog = await readFile(join(store.runDirectory, "runner.log"), "utf8")
		assert.match(manifestBeforeFinish, /"status": "running"/)
		await store.finish("completed")
		const manifest = await readFile(manifestPath, "utf8")
		assert.match(manifest, /"status": "completed"/)
		assert.match(manifest, /"gpt-5\.6-luna"/)
		assert.doesNotMatch(manifest, new RegExp(secret))
		assert.match(outcomes, /usefulResponse/)
		assert.match(outcomes, /,Yes,,http\/test-attempt\.http/)
		assert.match(runnerLog, /^Run started\ntemperature: gpt-5\.6-luna — HTTP 200, useful: Yes\n$/)
		assert.match(rawHttp, /<REDACTED_API_TOKEN>/)
		assert.doesNotMatch(rawHttp, new RegExp(secret))
	} finally {
		await rm(temporaryRoot, { recursive: true, force: true })
	}
})
