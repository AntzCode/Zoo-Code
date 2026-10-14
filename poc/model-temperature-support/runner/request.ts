import { randomUUID } from "node:crypto"

import type {
	AttemptRecord,
	ModelDefinition,
	PromptCase,
	ProviderDefinition,
	RequestCondition,
	RequestResult,
	ReasoningEffort,
} from "./types.js"

export const REDACTED_API_TOKEN = "<REDACTED_API_TOKEN>"

export interface ExecuteRequestOptions {
	provider: ProviderDefinition
	model: ModelDefinition
	promptCase: PromptCase
	effort: ReasoningEffort
	condition: RequestCondition
	probeKind: AttemptRecord["probeKind"]
	apiKey: string
	attemptNumber: number
	fetchImpl?: typeof fetch
	clock?: () => Date
	monotonicNow?: () => number
}

export function createResponsesBody(
	model: ModelDefinition,
	promptCase: PromptCase,
	effort: ReasoningEffort,
	condition: RequestCondition,
): Record<string, unknown> {
	return {
		model: model.id,
		input: promptCase.prompt,
		stream: false,
		store: false,
		max_output_tokens: promptCase.maxOutputTokens,
		reasoning: { effort },
		...(condition.temperature !== undefined ? { temperature: condition.temperature } : {}),
		...(condition.topP !== undefined ? { top_p: condition.topP } : {}),
	}
}

export function extractResponseText(body: unknown): string {
	if (!body || typeof body !== "object") return ""
	const response = body as { output_text?: unknown; output?: unknown }
	if (typeof response.output_text === "string") return response.output_text
	if (!Array.isArray(response.output)) return ""

	return response.output
		.filter((item): item is { type?: unknown; content?: unknown } => Boolean(item && typeof item === "object"))
		.filter((item) => item.type === "message" && Array.isArray(item.content))
		.flatMap((item) => item.content as unknown[])
		.filter((part): part is { type?: unknown; text?: unknown } => Boolean(part && typeof part === "object"))
		.filter((part) => part.type === "output_text" && typeof part.text === "string")
		.map((part) => part.text as string)
		.join("\n")
}

export function isUsefulResponse(promptCase: PromptCase, responseText: string): boolean {
	const normalizedResponse = responseText.trim()
	if (!normalizedResponse) return false

	const rule = promptCase.usefulResponse
	if (rule.type === "non-empty-text") return true
	return new RegExp(rule.pattern, rule.flags).test(normalizedResponse)
}

function redact(value: string, secret: string): string {
	return secret ? value.replaceAll(secret, REDACTED_API_TOKEN) : value
}

function serializeHeaders(headers: Headers, secret: string): string[] {
	const entries = [...headers.entries()].map(([name, value]) => [name, redact(value, secret)] as const)
	return entries.map(([name, value]) => `${name}: ${value}`)
}

export function makeRawHttpTranscript(input: {
	url: URL
	requestHeaders: Headers
	requestBody: string
	responseStatus: number | null
	responseStatusText: string
	responseHeaders?: Headers
	responseBody: string
	secret: string
}): string {
	const requestPath = `${input.url.pathname}${input.url.search}`
	const request = [
		`POST ${requestPath} HTTP/1.1`,
		`host: ${input.url.host}`,
		...serializeHeaders(input.requestHeaders, input.secret),
		"",
		redact(input.requestBody, input.secret),
	]
	const responseHeaders = input.responseHeaders ? serializeHeaders(input.responseHeaders, input.secret) : []
	const response = [
		input.responseStatus === null
			? `HTTP/1.1 000 ${input.responseStatusText || "NO RESPONSE"}`
			: `HTTP/1.1 ${input.responseStatus} ${input.responseStatusText}`.trimEnd(),
		...responseHeaders,
		"",
		redact(input.responseBody, input.secret),
	]
	return `${request.join("\r\n")}\r\n\r\n${response.join("\r\n")}\r\n`
}

export async function executeResponsesRequest(options: ExecuteRequestOptions): Promise<RequestResult> {
	const fetchImpl = options.fetchImpl ?? fetch
	const clock = options.clock ?? (() => new Date())
	const monotonicNow = options.monotonicNow ?? (() => performance.now())
	const attemptId = randomUUID()
	const timestamp = clock().toISOString()
	const baseUrl = options.provider.baseUrl.endsWith("/") ? options.provider.baseUrl : `${options.provider.baseUrl}/`
	const url = new URL("responses", baseUrl)
	const requestBody = createResponsesBody(options.model, options.promptCase, options.effort, options.condition)
	const serializedRequestBody = JSON.stringify(requestBody)
	const apiKeyValue = options.provider.apiKeyPrefix
		? `${options.provider.apiKeyPrefix} ${options.apiKey}`
		: options.apiKey
	const requestHeaders = new Headers({
		accept: "application/json",
		"content-type": "application/json",
		[options.provider.apiKeyHeader]: apiKeyValue,
		[options.provider.sessionHeader]: attemptId,
	})
	const baseRecord: Omit<
		AttemptRecord,
		"responseTimeMs" | "executionStatus" | "httpStatus" | "usefulResponse" | "error" | "rawHttpFile"
	> = {
		attemptId,
		attemptNumber: options.attemptNumber,
		timestamp,
		providerId: options.provider.id,
		modelId: options.model.id,
		apiFormat: options.provider.apiFormat,
		caseId: options.promptCase.id,
		caseName: options.promptCase.name,
		reasoningEffort: options.effort,
		temperature: options.condition.temperature ?? null,
		topP: options.condition.topP ?? null,
		probeKind: options.probeKind,
	}

	const requestStartedAt = monotonicNow()
	let responseTimeMs: number | null = null
	let responseStatus: number | null = null
	let responseStatusText = ""
	let responseHeaders: Headers | undefined
	let responseBody = ""
	let usefulResponse = false
	let error: string | null = null
	let executionStatus: AttemptRecord["executionStatus"] = "completed"

	try {
		const response = await fetchImpl(url, {
			method: "POST",
			headers: requestHeaders,
			body: serializedRequestBody,
			signal: AbortSignal.timeout(120_000),
		})
		responseStatus = response.status
		responseStatusText = response.statusText
		responseHeaders = response.headers
		responseBody = await response.text()
		responseTimeMs = Math.max(0, monotonicNow() - requestStartedAt)
		if (response.ok) {
			try {
				const parsed: unknown = JSON.parse(responseBody)
				usefulResponse = isUsefulResponse(options.promptCase, extractResponseText(parsed))
			} catch {
				error = "Successful HTTP response body was not valid JSON."
			}
		} else {
			executionStatus = "http_error"
			error = errorFromResponse(responseBody, options.apiKey)
		}
	} catch (caught) {
		responseTimeMs = Math.max(0, monotonicNow() - requestStartedAt)
		executionStatus = "network_error"
		error = redact(caught instanceof Error ? caught.message : String(caught), options.apiKey)
		responseStatusText = "NO RESPONSE"
		responseBody = error
	}

	const rawHttp = makeRawHttpTranscript({
		url,
		requestHeaders,
		requestBody: serializedRequestBody,
		responseStatus,
		responseStatusText,
		...(responseHeaders ? { responseHeaders } : {}),
		responseBody,
		secret: options.apiKey,
	})

	return {
		record: {
			...baseRecord,
			responseTimeMs,
			executionStatus,
			httpStatus: responseStatus,
			usefulResponse,
			error,
			rawHttpFile: `http/${attemptId}.http`,
		},
		rawHttp,
	}
}

function errorFromResponse(responseBody: string, secret: string): string {
	try {
		const body: unknown = JSON.parse(responseBody)
		if (body && typeof body === "object") {
			const record = body as { error?: unknown }
			const errorBody = record.error
			if (errorBody && typeof errorBody === "object") {
				const message = (errorBody as { message?: unknown }).message
				if (typeof message === "string") return redact(message, secret)
			}
		}
	} catch {
		// Keep a short sanitized body excerpt below for non-JSON error replies.
	}
	return redact(responseBody.replace(/\s+/g, " ").slice(0, 500), secret) || "HTTP request failed."
}
