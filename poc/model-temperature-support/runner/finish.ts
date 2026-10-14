import type { RunStore } from "./results.js"
import type { AttemptRecord } from "./types.js"

export async function finishRun(input: {
	store: RunStore
	failedAttempts: readonly AttemptRecord[]
	logLine: (message: string) => Promise<void>
}): Promise<void> {
	const failedCount = input.failedAttempts.length
	await input.store.finish(failedCount === 0 ? "completed" : "completed-with-errors")
	await input.logLine(`\nRun records saved to ${input.store.runDirectory}`)

	if (failedCount > 0) {
		await input.logLine(`Run completed with ${failedCount} failed request(s). See outcomes.csv for details.`)
		return
	}

	await input.logLine("Run completed with no unresolved request failures.")
}
