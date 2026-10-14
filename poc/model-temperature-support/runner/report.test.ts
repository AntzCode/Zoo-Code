import { mkdtemp, mkdir, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { strict as assert } from "node:assert"
import { test } from "node:test"

import { discoverRuns, generate, reportInternals } from "./report.js"

const fields = [
	"attemptId",
	"attemptNumber",
	"timestamp",
	"responseTimeMs",
	"providerId",
	"modelId",
	"apiFormat",
	"caseId",
	"caseName",
	"reasoningEffort",
	"temperature",
	"topP",
	"probeKind",
	"executionStatus",
	"httpStatus",
	"usefulResponse",
	"error",
	"rawHttpFile",
]

function csvCell(value: string): string {
	return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value
}

function row(values: Record<string, string>): string {
	return fields.map((field) => csvCell(values[field] ?? "")).join(",")
}

async function fixtureRun(): Promise<string> {
	const root = await mkdtemp(join(tmpdir(), "temperature-report-"))
	await mkdir(join(root, "http"))
	const manifest = {
		runId: "fixture-run",
		status: "completed",
		startedAt: "2026-10-14T00:00:00.000Z",
		providerId: "opencode-go",
		apiFormat: "responses",
		models: [{ id: "gpt-5.6-luna", reasoningEfforts: ["none"] }],
		temperatures: [0.5],
		promptCaseIds: ["arithmetic-answer"],
	}
	await writeFile(join(root, "manifest.json"), `${JSON.stringify(manifest)}\n`)
	const records = [
		{
			attemptId: "baseline",
			attemptNumber: "1",
			timestamp: manifest.startedAt,
			responseTimeMs: "12",
			providerId: "opencode-go",
			modelId: "gpt-5.6-luna",
			apiFormat: "responses",
			caseId: "arithmetic-answer",
			caseName: "Correct arithmetic answer",
			reasoningEffort: "none",
			temperature: "",
			topP: "",
			probeKind: "baseline",
			executionStatus: "completed",
			httpStatus: "200",
			usefulResponse: "Yes",
			error: "",
			rawHttpFile: "http/baseline.http",
		},
		{
			attemptId: "temperature",
			attemptNumber: "1",
			timestamp: manifest.startedAt,
			responseTimeMs: "1001",
			providerId: "opencode-go",
			modelId: "gpt-5.6-luna",
			apiFormat: "responses",
			caseId: "arithmetic-answer",
			caseName: "Correct arithmetic answer",
			reasoningEffort: "none",
			temperature: "0.5",
			topP: "",
			probeKind: "temperature",
			executionStatus: "http_error",
			httpStatus: "400",
			usefulResponse: "No",
			error: "",
			rawHttpFile: "http/temperature.http",
		},
		{
			attemptId: "top-p",
			attemptNumber: "1",
			timestamp: manifest.startedAt,
			responseTimeMs: "1",
			providerId: "opencode-go",
			modelId: "gpt-5.6-luna",
			apiFormat: "responses",
			caseId: "arithmetic-answer",
			caseName: "Correct arithmetic answer",
			reasoningEffort: "none",
			temperature: "0.5",
			topP: "0.9",
			probeKind: "top-p-compatibility",
			executionStatus: "completed",
			httpStatus: "200",
			usefulResponse: "Yes",
			error: "",
			rawHttpFile: "http/top-p.http",
		},
	]
	await writeFile(join(root, "outcomes.csv"), `${fields.join(",")}\r\n${records.map(row).join("\r\n")}\r\n`)
	const response = (value: string, status = "200 OK") =>
		`HTTP/1.1 ${status}\r\ncontent-type: application/json\r\n\r\n${JSON.stringify({ output: [{ content: [{ text: value }] }] })}`
	await writeFile(join(root, "http/baseline.http"), response("ANSWER: 323"))
	await writeFile(join(root, "http/temperature.http"), response("<not useful & escaped>", "400 Bad Request"))
	return root
}

test("parses quoted CSV fields and normalizes temperatures", () => {
	const parsed = reportInternals.parseCsv('a,b\n"quoted, value","line\nvalue"\n')
	assert.deepEqual(parsed, [{ a: "quoted, value", b: "line\nvalue" }])
	assert.equal(reportInternals.formatTemperature(1.5), "1.5")
	assert.equal(reportInternals.key("model", "case", "none", null), '["model","case","none",null]')
	assert.equal(reportInternals.httpOk({ httpStatus: "200" }), true)
	assert.equal(reportInternals.httpOk({ httpStatus: "204" }), true)
	assert.equal(reportInternals.httpOk({ httpStatus: "400" }), false)
	assert.equal(reportInternals.httpOk({ executionStatus: "network_error" }), false)
})

test("generates self-contained matrix and evidence from the manifest coordinate set", async () => {
	const runDirectory = await fixtureRun()
	const paths = await generate(runDirectory)
	const { readFile } = await import("node:fs/promises")
	const matrix = await readFile(paths.matrixPath, "utf8")
	const evidence = await readFile(paths.evidencePath, "utf8")
	assert.match(matrix, /Omitted/)
	assert.match(matrix, /0\.5/)
	assert.match(matrix, /Arithmetic HTTP Response/)
	assert.match(matrix, /aria-label="HTTP response error"/)
	assert.ok(matrix.indexOf("Arithmetic HTTP Response") < matrix.indexOf("Arithmetic question"))
	assert.doesNotMatch(matrix, /Zoo Code|<img|data:image/)
	assert.doesNotMatch(evidence, /Zoo Code|<img|data:image/)
	assert.match(matrix, /HTTP response: HTTP 200/)
	assert.match(matrix, /&lt;not useful &amp; escaped&gt;/)
	assert.match(evidence, /ANSWER: 323/)
	assert.match(evidence, /&lt;not useful &amp; escaped&gt;/)
	assert.doesNotMatch(matrix, /<script|<link|href="http|src="http/i)
	assert.doesNotMatch(evidence, /<script|<link|href="http|src="http/i)
})

test("discovers only manifest directories in descending folder-name order", async () => {
	const root = await mkdtemp(join(tmpdir(), "temperature-discovery-"))
	await mkdir(join(root, "not-a-run"))
	const run = await fixtureRun()
	const { readFile } = await import("node:fs/promises")
	const manifest = await readFile(join(run, "manifest.json"))
	const oldRun = join(root, "2026-10-12T00-00-00-000Z-old")
	const newRun = join(root, "2026-10-14T00-00-00-000Z-new")
	await mkdir(oldRun)
	await mkdir(newRun)
	await writeFile(join(oldRun, "manifest.json"), manifest)
	await writeFile(join(newRun, "manifest.json"), manifest)
	assert.deepEqual(await discoverRuns(root), [newRun, oldRun])
})
