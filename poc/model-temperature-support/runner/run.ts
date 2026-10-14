import { checkbox, confirm, password, select } from "@inquirer/prompts"

import { loadPromptCases } from "./cases.js"
import { DEFAULT_INTER_REQUEST_DELAY_MS, DEFAULT_TEMPERATURE_VALUES, TOP_P_COMPATIBILITY_VALUE } from "./constants.js"
import { executeMatrix } from "./execute.js"
import { finishRun } from "./finish.js"
import { models } from "./models.js"
import { providers } from "./providers.js"
import { createRunStore, type RunSelection, type RunStore } from "./results.js"
import type { AttemptRecord, ModelDefinition, ReasoningEffort } from "./types.js"

const bufferedLogLines: string[] = []
let activeRunStore: RunStore | undefined

async function logLine(message: string): Promise<void> {
	console.log(message)
	if (activeRunStore) await activeRunStore.appendLog(message)
	else bufferedLogLines.push(message)
}

async function main(): Promise<void> {
	if (!process.stdin.isTTY || !process.stdout.isTTY) {
		throw new Error("The temperature test runner requires an interactive terminal.")
	}

	const providerId = await select({
		message: "Select a provider gateway",
		choices: providers.map((provider) => ({ name: provider.name, value: provider.id })),
	})
	const provider = providers.find((candidate) => candidate.id === providerId)
	if (!provider) throw new Error(`Unknown provider selected: ${providerId}`)

	const apiKey = (
		await password({
			message: `Enter the ${provider.name} API key (input is masked)`,
			mask: "*",
			validate: (value) => value.trim().length > 0 || "Enter a non-empty API key.",
		})
	).trim()
	process.env[provider.apiKeyEnvironmentVariable] = apiKey

	try {
		const providerModels = models.filter((model) => model.providerId === provider.id)
		const modelIds = await checkbox({
			message: "Select catalogued models to test",
			choices: providerModels.map((model) => ({
				name: `${model.name} (${model.id})`,
				value: model.id,
			})),
		})
		if (modelIds.length === 0) throw new Error("Select at least one model.")
		const selectedModels = modelIds.map((modelId) => requiredModel(providerModels, modelId))

		const effortsByModel = await selectEfforts(selectedModels)
		const selectedTemperatures = await checkbox({
			message: "Select temperature values to probe",
			choices: DEFAULT_TEMPERATURE_VALUES.map((value) => ({
				name: String(value),
				value: String(value),
				checked: true,
			})),
		})
		if (selectedTemperatures.length === 0) throw new Error("Select at least one temperature value.")
		const temperatures = selectedTemperatures.map(Number)

		const promptCases = await loadPromptCases(provider.id)
		const selectedCaseIds = await checkbox({
			message: "Select prompt cases (regex cases check criteria; open-ended cases accept any non-empty response)",
			choices: promptCases.map((promptCase) => ({
				name: `${promptCase.name} (${promptCase.id})`,
				value: promptCase.id,
				checked: true,
			})),
		})
		if (selectedCaseIds.length === 0) throw new Error("Select at least one prompt case.")
		const selectedCases = promptCases.filter((promptCase) => selectedCaseIds.includes(promptCase.id))

		const topPCompatibility = await confirm({
			message: `Run the separate temperature + top_p=${TOP_P_COMPATIBILITY_VALUE} compatibility probes?`,
			default: false,
		})
		const selection: RunSelection = {
			provider,
			models: selectedModels,
			effortsByModel,
			temperatures,
			promptCases: selectedCases,
			topPCompatibility,
		}
		const primaryRequests = countPrimaryRequests(selection)
		const compatibilityUpperBound = topPCompatibility ? countCompatibilityProbes(selection) * 2 : 0
		const bufferedLogIndex = bufferedLogLines.length
		await logLine(
			`\nApproximate request count: ${primaryRequests} primary requests, plus up to ${compatibilityUpperBound} compatibility/diagnostic requests. Documented-incompatible conditions and temperatures rejected by the gateway can reduce this count.`,
		)
		await logLine(`Models: ${selectedModels.map(({ id }) => id).join(", ")}`)
		await logLine(`Prompt cases: ${selectedCases.map(({ id }) => id).join(", ")}`)
		await logLine(`Temperatures: ${temperatures.join(", ")}`)
		if (!(await confirm({ message: "Start this test run?", default: false }))) {
			await logLine("Run cancelled; no requests were sent.")
			return
		}

		const store = await createRunStore(selection)
		activeRunStore = store
		for (const line of bufferedLogLines.slice(bufferedLogIndex)) await store.appendLog(line)
		bufferedLogLines.length = bufferedLogIndex
		await logLine(`\nRun ID: ${store.runId}`)
		await logLine("Gateway session scope: a fresh session ID per HTTP test request.")
		await logLine(
			`Running requests sequentially with a ${DEFAULT_INTER_REQUEST_DELAY_MS} ms pause between gateway requests. Raw HTTP records redact the API key.\n`,
		)
		await logLine("Each selected test request gets one attempt. Failed requests are not retried.")
		const onAttempt = async (attempt: AttemptRecord) => {
			const temperature = attempt.temperature === null ? "omitted" : String(attempt.temperature)
			const status = attempt.httpStatus === null ? attempt.executionStatus : `HTTP ${attempt.httpStatus}`
			await logLine(
				`${attempt.probeKind}: ${attempt.modelId} / ${attempt.reasoningEffort} / temp ${temperature} / ${attempt.caseId} — ${status}, useful: ${attempt.usefulResponse ? "Yes" : "No"}`,
			)
		}
		const executeOptions = { selection, store, apiKey, onAttempt }
		const failedAttempts = await executeMatrix(executeOptions)
		await finishRun({ store, failedAttempts, logLine })
	} finally {
		delete process.env[provider.apiKeyEnvironmentVariable]
	}
}

async function selectEfforts(
	selectedModels: readonly ModelDefinition[],
): Promise<ReadonlyMap<string, readonly ReasoningEffort[]>> {
	const choices = selectedModels.flatMap((model) =>
		model.reasoningEfforts.map((effort) => ({
			name: `${model.name} — ${effort}`,
			value: `${model.id}::${effort}`,
			checked: true,
		})),
	)
	const selected = await checkbox({ message: "Select model thinking levels", choices })
	if (selected.length === 0) throw new Error("Select at least one model/thinking-level combination.")

	const result = new Map<string, ReasoningEffort[]>()
	for (const value of selected) {
		const separator = value.lastIndexOf("::")
		const modelId = value.slice(0, separator)
		const effort = value.slice(separator + 2) as ReasoningEffort
		const current = result.get(modelId) ?? []
		current.push(effort)
		result.set(modelId, current)
	}
	return result
}

function requiredModel(providerModels: readonly ModelDefinition[], modelId: string): ModelDefinition {
	const model = providerModels.find((candidate) => candidate.id === modelId)
	if (!model) throw new Error(`Model is not present in the local catalog: ${modelId}`)
	return model
}

function countPrimaryRequests(selection: RunSelection): number {
	let count = 0
	for (const model of selection.models) {
		const effortCount = selection.effortsByModel.get(model.id)?.length ?? 0
		count += effortCount * selection.promptCases.length * (1 + selection.temperatures.length)
	}
	return count
}

function countCompatibilityProbes(selection: RunSelection): number {
	return selection.models.reduce((total, model) => {
		const compatibleEfforts = (selection.effortsByModel.get(model.id) ?? []).filter(
			(effort) => model.temperatureTopPCompatibility !== "none-only" || effort === "none",
		)
		return total + compatibleEfforts.length
	}, 0)
}

void main().catch(async (error: unknown) => {
	const message = error instanceof Error ? error.message : String(error)
	const logMessage = `Temperature runner failed: ${message}`
	process.stderr.write(`${logMessage}\n`)
	try {
		await activeRunStore?.appendLog(logMessage)
	} catch {
		// Preserve the original runner error if its log entry cannot be written.
	}
	process.exitCode = 1
})
