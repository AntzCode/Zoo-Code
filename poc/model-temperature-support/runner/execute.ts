import { DEFAULT_INTER_REQUEST_DELAY_MS, TOP_P_COMPATIBILITY_VALUE } from "./constants.js"
import { executeResponsesRequest } from "./request.js"
import { makeNotRunRecord, type RunSelection, type RunStore } from "./results.js"
import type { AttemptRecord, ModelDefinition, PromptCase, ProviderDefinition, ReasoningEffort } from "./types.js"

export interface ExecuteOptions {
	selection: RunSelection
	store: RunStore
	apiKey: string
	fetchImpl?: typeof fetch
	clock?: () => Date
	monotonicNow?: () => number
	onAttempt?: (attempt: AttemptRecord) => void | Promise<void>
	delayMs?: number
	sleep?: (milliseconds: number) => Promise<void>
}

export async function executeMatrix(options: ExecuteOptions): Promise<AttemptRecord[]> {
	const failures: AttemptRecord[] = []
	const delayMs = options.delayMs ?? DEFAULT_INTER_REQUEST_DELAY_MS
	if (!Number.isFinite(delayMs) || delayMs < 0) throw new Error("Inter-request delay must be a non-negative number.")
	const sleep =
		options.sleep ?? ((milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds)))
	let hasSentRequest = false
	const { selection } = options
	const runRequest = async (input: Parameters<typeof runAndRecord>[1]): Promise<AttemptRecord> => {
		if (hasSentRequest && delayMs > 0) await sleep(delayMs)
		hasSentRequest = true
		return runAndRecord(options, input)
	}
	for (const model of selection.models) {
		const efforts = selection.effortsByModel.get(model.id) ?? []
		for (const effort of efforts) {
			for (const promptCase of selection.promptCases) {
				await runRequest({
					model,
					promptCase,
					effort,
					condition: {},
					probeKind: "baseline",
					attemptNumber: 1,
					failures,
				})

				for (const temperature of selection.temperatures) {
					await runRequest({
						model,
						promptCase,
						effort,
						condition: { temperature },
						probeKind: "temperature",
						attemptNumber: 1,
						failures,
					})
				}
			}

			if (selection.topPCompatibility && selection.promptCases[0]) {
				await runTopPCompatibility(options, model, effort, selection.promptCases[0], failures, runRequest)
			}
		}
	}
	return failures
}

async function runAndRecord(
	options: ExecuteOptions,
	input: {
		model: ModelDefinition
		promptCase: PromptCase
		effort: ReasoningEffort
		condition: { temperature?: number; topP?: number }
		probeKind: AttemptRecord["probeKind"]
		attemptNumber: number
		failures: AttemptRecord[]
	},
): Promise<AttemptRecord> {
	const result = await executeResponsesRequest({
		provider: options.selection.provider,
		model: input.model,
		promptCase: input.promptCase,
		effort: input.effort,
		condition: input.condition,
		probeKind: input.probeKind,
		apiKey: options.apiKey,
		attemptNumber: input.attemptNumber,
		...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
		...(options.clock ? { clock: options.clock } : {}),
		...(options.monotonicNow ? { monotonicNow: options.monotonicNow } : {}),
	})
	await options.store.appendAttempt(result.record, result.rawHttp)
	await options.onAttempt?.(result.record)
	if (isFailed(result.record)) input.failures.push(result.record)
	return result.record
}

async function runTopPCompatibility(
	options: ExecuteOptions,
	model: ModelDefinition,
	effort: ReasoningEffort,
	promptCase: PromptCase,
	failures: AttemptRecord[],
	runRequest: (input: Parameters<typeof runAndRecord>[1]) => Promise<AttemptRecord>,
): Promise<void> {
	if (model.temperatureTopPCompatibility === "none-only" && effort !== "none") {
		await options.store.addAttemptNote(
			makeNotRunRecord({
				provider: options.selection.provider,
				model,
				promptCase,
				effort,
				condition: { temperature: 1, topP: TOP_P_COMPATIBILITY_VALUE },
				probeKind: "top-p-compatibility",
				reason: "Not sent: provider documentation says to omit temperature and top_p unless reasoning effort is none.",
				...(options.clock ? { clock: options.clock } : {}),
			}),
		)
		return
	}

	const temperatureAttempts = await options.store.readAttempts()
	const acceptedTemperature = options.selection.temperatures.find((temperature) =>
		temperatureAttempts.some(
			(attempt) =>
				attempt.modelId === model.id &&
				attempt.caseId === promptCase.id &&
				attempt.reasoningEffort === effort &&
				attempt.probeKind === "temperature" &&
				attempt.temperature === temperature &&
				attempt.httpStatus !== null &&
				attempt.httpStatus >= 200 &&
				attempt.httpStatus < 300,
		),
	)
	if (acceptedTemperature === undefined) {
		await options.store.addAttemptNote(
			makeNotRunRecord({
				provider: options.selection.provider,
				model,
				promptCase,
				effort,
				condition: { temperature: 1, topP: TOP_P_COMPATIBILITY_VALUE },
				probeKind: "top-p-compatibility",
				reason: "Not sent: no requested temperature returned a successful HTTP status for this model and effort.",
				executionStatus: "not_run_no_accepted_temperature",
				...(options.clock ? { clock: options.clock } : {}),
			}),
		)
		return
	}

	const condition = { temperature: acceptedTemperature, topP: TOP_P_COMPATIBILITY_VALUE }
	const pairAttempt = await runRequest({
		model,
		promptCase,
		effort,
		condition,
		probeKind: "top-p-compatibility",
		attemptNumber: 1,
		failures,
	})
	if (
		pairAttempt.httpStatus !== 400 ||
		!/(temperature|top[_ -]?p|unsupported.*parameter|parameter.*unsupported|cannot.*combine)/i.test(
			pairAttempt.error ?? "",
		)
	)
		return

	await runRequest({
		model,
		promptCase,
		effort,
		condition: { topP: TOP_P_COMPATIBILITY_VALUE },
		probeKind: "top-p-diagnostic",
		attemptNumber: 1,
		failures,
	})
}

function isFailed(attempt: AttemptRecord): boolean {
	return attempt.executionStatus !== "completed" || !attempt.usefulResponse
}
