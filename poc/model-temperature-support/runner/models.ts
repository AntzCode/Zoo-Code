import type { ModelDefinition } from "./types.js"

export const models: readonly ModelDefinition[] = [
	{
		id: "gpt-5.6-luna",
		name: "GPT-5.6 Luna",
		providerId: "opencode-go",
		reasoningEfforts: ["none", "low", "medium", "high", "xhigh", "max"],
		temperatureTopPCompatibility: "probe",
	},
	{
		id: "gpt-6-luna",
		name: "GPT-6 Luna",
		providerId: "opencode-go",
		reasoningEfforts: ["none", "low", "medium", "high", "xhigh", "max"],
		temperatureTopPCompatibility: "none-only",
	},
	{
		id: "grok-4.6",
		name: "Grok 4.6",
		providerId: "opencode-go",
		reasoningEfforts: ["low", "medium", "high", "xhigh"],
		temperatureTopPCompatibility: "probe",
	},
	{
		id: "grok-4.7",
		name: "Grok 4.7",
		providerId: "opencode-go",
		reasoningEfforts: ["low", "medium", "high", "xhigh"],
		temperatureTopPCompatibility: "probe",
	},
	{
		id: "muse-spark-1.3-contributor",
		name: "Muse Spark 1.3 Contributor",
		providerId: "opencode-go",
		reasoningEfforts: ["minimal", "low", "medium", "high", "xhigh"],
		temperatureTopPCompatibility: "probe",
	},
	{
		id: "muse-spark-1.2-contributor",
		name: "Muse Spark 1.2 Contributor",
		providerId: "opencode-go",
		reasoningEfforts: ["minimal", "low", "medium", "high", "xhigh"],
		temperatureTopPCompatibility: "probe",
	},
]

export function getModel(providerId: string, modelId: string): ModelDefinition | undefined {
	return models.find((model) => model.providerId === providerId && model.id === modelId)
}
