import assert from "node:assert/strict"
import test from "node:test"

import { finishRun } from "./finish.js"
import type { RunStore } from "./results.js"
import type { AttemptRecord } from "./types.js"

type RunStoreFinishStatus = Parameters<RunStore["finish"]>[0]

const failedAttempt: AttemptRecord = {
	attemptId: "failed-attempt",
	attemptNumber: 1,
	timestamp: "2026-10-13T12:00:00.000Z",
	responseTimeMs: 245,
	providerId: "opencode-go",
	modelId: "gpt-6-luna",
	apiFormat: "responses",
	caseId: "arithmetic-answer",
	caseName: "Correct arithmetic answer",
	reasoningEffort: "medium",
	temperature: 0,
	topP: null,
	probeKind: "temperature",
	executionStatus: "http_error",
	httpStatus: 400,
	usefulResponse: false,
	error: "Unsupported temperature",
	rawHttpFile: "http/failed-attempt.http",
}

function makeStore(onFinish: (status: RunStoreFinishStatus) => void): RunStore {
	return {
		runId: "run-test",
		runDirectory: "results/generated/run-test",
		readAttempts: () => [],
		appendAttempt: async () => {},
		addAttemptNote: async () => {},
		appendLog: async () => {},
		finish: async (status) => onFinish(status),
	}
}

test("failed test outcomes finalize and summarize the run without treating it as a runner error", async () => {
	let finalStatus: RunStoreFinishStatus | undefined
	const logLines: string[] = []
	await finishRun({
		store: makeStore((status) => {
			finalStatus = status
		}),
		failedAttempts: [failedAttempt],
		logLine: async (message) => {
			logLines.push(message)
		},
	})

	assert.equal(finalStatus, "completed-with-errors")
	assert.deepEqual(logLines, [
		"\nRun records saved to results/generated/run-test",
		"Run completed with 1 failed request(s). See outcomes.csv for details.",
	])
})
