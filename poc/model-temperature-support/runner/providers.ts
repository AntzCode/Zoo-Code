import type { ProviderDefinition } from "./types.js"

export const providers: readonly ProviderDefinition[] = [
	{
		id: "opencode-go",
		name: "OpenCode Go",
		apiFormat: "responses",
		baseUrl: "https://opencode.ai/zen/go/v1/",
		apiKeyEnvironmentVariable: "OPENCODE_GO_API_KEY",
		apiKeyHeader: "authorization",
		apiKeyPrefix: "Bearer",
		sessionHeader: "x-opencode-session",
	},
]

export function getProvider(providerId: string): ProviderDefinition | undefined {
	return providers.find((provider) => provider.id === providerId)
}
