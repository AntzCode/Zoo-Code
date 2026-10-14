import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"

import type { PromptCase } from "./types.js"

const CASES_DIRECTORY = new URL("../cases/", import.meta.url)

function isObjectRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isPromptCase(value: unknown): value is PromptCase {
	if (!isObjectRecord(value)) return false
	if (
		typeof value.id !== "string" ||
		value.id.trim().length === 0 ||
		typeof value.name !== "string" ||
		value.name.trim().length === 0 ||
		typeof value.prompt !== "string" ||
		value.prompt.trim().length === 0 ||
		typeof value.maxOutputTokens !== "number" ||
		!Number.isInteger(value.maxOutputTokens) ||
		value.maxOutputTokens <= 0 ||
		!isObjectRecord(value.usefulResponse)
	) {
		return false
	}

	const rule = value.usefulResponse
	if (rule.type === "non-empty-text") return Object.keys(rule).length === 1
	if (
		rule.type !== "regex" ||
		typeof rule.pattern !== "string" ||
		(rule.flags !== undefined && typeof rule.flags !== "string") ||
		Object.keys(rule).some((key) => key !== "type" && key !== "pattern" && key !== "flags")
	) {
		return false
	}

	try {
		new RegExp(rule.pattern, typeof rule.flags === "string" ? rule.flags : undefined)
		return true
	} catch {
		return false
	}
}

export async function loadPromptCases(providerId: string): Promise<PromptCase[]> {
	const caseUrl = new URL(`${providerId}.json`, CASES_DIRECTORY)
	const filePath = fileURLToPath(caseUrl)
	let parsed: unknown
	try {
		parsed = JSON.parse(await readFile(filePath, "utf8"))
	} catch (error) {
		throw new Error(`Could not load prompt cases for ${providerId}: ${errorMessage(error)}`)
	}

	if (!Array.isArray(parsed) || parsed.length === 0 || !parsed.every(isPromptCase)) {
		throw new Error(`Prompt case file for ${providerId} must contain at least one valid prompt case.`)
	}

	const ids = new Set(parsed.map((promptCase) => promptCase.id))
	if (ids.size !== parsed.length) {
		throw new Error(`Prompt case IDs for ${providerId} must be unique.`)
	}

	return parsed
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error)
}
