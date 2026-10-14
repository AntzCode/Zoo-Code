import assert from "node:assert/strict"
import test from "node:test"

import { serializeAttemptsCsv } from "./csv.js"
import type { AttemptRecord } from "./types.js"

const attempt: AttemptRecord = {
	attemptId: "attempt-1",
	attemptNumber: 1,
	timestamp: "2026-10-13T12:00:00.000Z",
	responseTimeMs: 245.7,
	providerId: "opencode-go",
	modelId: "gpt-6-luna",
	apiFormat: "responses",
	caseId: "arithmetic-answer",
	caseName: "Correct arithmetic answer",
	reasoningEffort: "medium",
	temperature: 0.5,
	topP: null,
	probeKind: "temperature",
	executionStatus: "completed",
	httpStatus: 200,
	usefulResponse: true,
	error: null,
	rawHttpFile: "http/attempt-1.http",
}

test("CSV serializes booleans, response time, and quotes delimiters", () => {
	const output = serializeAttemptsCsv([
		attempt,
		{ ...attempt, attemptId: "attempt-2", attemptNumber: 2, usefulResponse: false, error: 'bad, "answer"' },
	])
	assert.match(output, /responseTimeMs/)
	assert.match(output, /,245\.7,opencode-go/)
	assert.match(output, /,Yes,,http\/attempt-1\.http/)
	assert.match(output, /,No,"bad, ""answer""",http\/attempt-1\.http/)
})

test("CSV leaves attempt number blank for a probe that was not run", () => {
	const notRun = {
		...attempt,
		attemptId: "not-run-probe",
		attemptNumber: null,
		executionStatus: "not_run_documented" as const,
		responseTimeMs: null,
		httpStatus: null,
		usefulResponse: false,
		error: "Not sent: documented constraint.",
		rawHttpFile: "",
	}

	const output = serializeAttemptsCsv([notRun])
	assert.match(output, /not-run-probe,,2026-10-13T12:00:00\.000Z/)
})
