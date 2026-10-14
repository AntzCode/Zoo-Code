import type { AttemptRecord } from "./types.js"

const CSV_HEADERS: readonly (keyof AttemptRecord)[] = [
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

function csvCell(value: unknown): string {
	const text =
		value === null || value === undefined ? "" : typeof value === "boolean" ? (value ? "Yes" : "No") : String(value)
	return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

export function serializeAttemptsCsv(attempts: readonly AttemptRecord[]): string {
	const header = CSV_HEADERS.join(",")
	const rows = attempts.map((attempt) => CSV_HEADERS.map((key) => csvCell(attempt[key])).join(","))
	return `${[header, ...rows].join("\r\n")}\r\n`
}
