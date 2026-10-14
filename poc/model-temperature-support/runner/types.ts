export type ReasoningEffort = "none" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max"

export interface ProviderDefinition {
	id: string
	name: string
	apiFormat: "responses"
	baseUrl: string
	apiKeyEnvironmentVariable: string
	apiKeyHeader: string
	apiKeyPrefix: string
	sessionHeader: string
}

export interface ModelDefinition {
	id: string
	name: string
	providerId: string
	reasoningEfforts: readonly ReasoningEffort[]
	temperatureTopPCompatibility: "probe" | "none-only"
}

export type UsefulResponseRule = { type: "regex"; pattern: string; flags?: string } | { type: "non-empty-text" }

export interface PromptCase {
	id: string
	name: string
	prompt: string
	maxOutputTokens: number
	usefulResponse: UsefulResponseRule
}

export interface RequestCondition {
	temperature?: number
	topP?: number
}

export interface AttemptRecord {
	attemptId: string
	attemptNumber: number | null
	timestamp: string
	responseTimeMs: number | null
	providerId: string
	modelId: string
	apiFormat: string
	caseId: string
	caseName: string
	reasoningEffort: ReasoningEffort
	temperature: number | null
	topP: number | null
	probeKind: "baseline" | "temperature" | "top-p-compatibility" | "top-p-diagnostic"
	executionStatus:
		| "completed"
		| "http_error"
		| "network_error"
		| "not_run_documented"
		| "not_run_no_accepted_temperature"
	httpStatus: number | null
	usefulResponse: boolean
	error: string | null
	rawHttpFile: string
}

export interface RequestResult {
	record: AttemptRecord
	rawHttp: string
}

export interface ResponsesRequestOptions {
	provider: ProviderDefinition
	model: ModelDefinition
	promptCase: PromptCase
	effort: ReasoningEffort
	condition: RequestCondition
	apiKey: string
	attemptNumber: number
	fetchImpl?: typeof fetch
	monotonicNow?: () => number
	clock?: () => Date
}
