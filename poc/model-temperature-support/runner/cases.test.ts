import assert from "node:assert/strict"
import test from "node:test"

import { loadPromptCases } from "./cases.js"

test("loads constrained and open-ended response cases from the provider catalog", async () => {
	const promptCases = await loadPromptCases("opencode-go")

	assert.deepEqual(
		promptCases.map(({ id }) => id),
		["arithmetic-answer", "subjective-blue"],
	)

	const openEndedCase = promptCases.find(({ id }) => id === "subjective-blue")
	assert.ok(openEndedCase)
	assert.match(openEndedCase.prompt, /What does the color blue feel like/)
	assert.deepEqual(openEndedCase.usefulResponse, { type: "non-empty-text" })
})
