import { randomUUID } from "node:crypto"
import { appendFile, mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

import { serializeAttemptsCsv } from "./csv.js"
import { TOP_P_COMPATIBILITY_VALUE } from "./constants.js"
import type { AttemptRecord, ModelDefinition, ProviderDefinition, PromptCase, ReasoningEffort } from "./types.js"

const GENERATED_RESULTS_DIRECTORY = fileURLToPath(new URL("../results/generated/", import.meta.url))

export interface RunSelection {
	provider: ProviderDefinition
	models: readonly ModelDefinition[]
	effortsByModel: ReadonlyMap<string, readonly ReasoningEffort[]>
	temperatures: readonly number[]
	promptCases: readonly PromptCase[]
	topPCompatibility: boolean
}

interface RunManifest {
	runId: string
	status: "running" | "completed" | "completed-with-errors"
	startedAt: string
	completedAt?: string
	providerId: string
	apiFormat: string
	models: Array<{ id: string; reasoningEfforts: ReasoningEffort[] }>
	temperatures: number[]
	promptCaseIds: string[]
	topPCompatibility: boolean
	topPCompatibilityValue: number | null
}

export interface RunStore {
	runId: string
	runDirectory: string
	readAttempts: () => readonly AttemptRecord[]
	appendAttempt: (attempt: AttemptRecord, rawHttp?: string) => Promise<void>
	addAttemptNote: (attempt: AttemptRecord) => Promise<void>
	appendLog: (line: string) => Promise<void>
	finish: (status: RunManifest["status"]) => Promise<void>
}

function fileSafeTimestamp(date: Date): string {
	return date.toISOString().replaceAll(":", "-").replaceAll(".", "-")
}

export async function createRunStore(
	selection: RunSelection,
	clock: () => Date = () => new Date(),
	resultsRoot = GENERATED_RESULTS_DIRECTORY,
): Promise<RunStore> {
	const startedAt = clock().toISOString()
	const runId = `${fileSafeTimestamp(new Date(startedAt))}-${randomUUID().slice(0, 8)}`
	const runDirectory = join(resultsRoot, runId)
	const httpDirectory = join(runDirectory, "http")
	await mkdir(httpDirectory, { recursive: true })

	const manifest: RunManifest = {
		runId,
		status: "running",
		startedAt,
		providerId: selection.provider.id,
		apiFormat: selection.provider.apiFormat,
		models: selection.models.map((model) => ({
			id: model.id,
			reasoningEfforts: [...(selection.effortsByModel.get(model.id) ?? [])],
		})),
		temperatures: [...selection.temperatures],
		promptCaseIds: selection.promptCases.map(({ id }) => id),
		topPCompatibility: selection.topPCompatibility,
		topPCompatibilityValue: selection.topPCompatibility ? TOP_P_COMPATIBILITY_VALUE : null,
	}
	const attempts: AttemptRecord[] = []
	const writeManifest = async () =>
		writeFile(join(runDirectory, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`)
	const writeCsv = async () => writeFile(join(runDirectory, "outcomes.csv"), serializeAttemptsCsv(attempts))
	await writeManifest()
	await writeCsv()

	return {
		runId,
		runDirectory,
		readAttempts: () => attempts,
		appendAttempt: async (attempt, rawHttp = "") => {
			attempts.push(attempt)
			if (rawHttp) await writeFile(join(runDirectory, attempt.rawHttpFile), rawHttp)
			await writeCsv()
		},
		addAttemptNote: async (attempt) => {
			attempts.push(attempt)
			await writeCsv()
		},
		appendLog: async (line) => {
			await appendFile(join(runDirectory, "runner.log"), `${line}\n`)
		},
		finish: async (status) => {
			manifest.status = status
			manifest.completedAt = clock().toISOString()
			await writeManifest()
		},
	}
}

export function makeNotRunRecord(input: {
	provider: ProviderDefinition
	model: ModelDefinition
	promptCase: PromptCase
	effort: ReasoningEffort
	condition: { temperature?: number; topP?: number }
	probeKind: AttemptRecord["probeKind"]
	reason: string
	executionStatus?: AttemptRecord["executionStatus"]
	clock?: () => Date
}): AttemptRecord {
	return {
		attemptId: `not-run-${randomUUID()}`,
		attemptNumber: null,
		timestamp: (input.clock ?? (() => new Date()))().toISOString(),
		responseTimeMs: null,
		providerId: input.provider.id,
		modelId: input.model.id,
		apiFormat: input.provider.apiFormat,
		caseId: input.promptCase.id,
		caseName: input.promptCase.name,
		reasoningEffort: input.effort,
		temperature: input.condition.temperature ?? null,
		topP: input.condition.topP ?? null,
		probeKind: input.probeKind,
		executionStatus: input.executionStatus ?? "not_run_documented",
		httpStatus: null,
		usefulResponse: false,
		error: input.reason,
		rawHttpFile: "",
	}
}
