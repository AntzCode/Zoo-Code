# Plan: Model Catalog Scope

## Objective

Record the current and planned Responses API model targets for the initial OpenCode Go test scope.

Keep the catalog extensible to other gateway providers and API formats; this research remains focused on temperature only.

The runner owns a stand-alone catalog and imports no Zoo Code implementation. Model capability documentation below is retained as research reference material; it does not replace live gateway results.

## Current Zoo Code Responses Routing Snapshot

The current routing source is [`OPENCODE_GO_RESPONSES_FORMAT_MODELS`](../../packages/types/src/providers/opencode-go.ts), verified by the exact-list test in [`opencode-go.test.ts`](../../packages/types/src/__tests__/opencode-go.test.ts):

- `gpt-5.6-luna`
- `gpt-6-luna`
- `grok-4.6`
- `muse-spark-1.3-contributor`
- `muse-spark-1.2-contributor`

These are routing targets, not claims that temperature is supported.

## Initial Temperature Test Targets

The initial evaluation includes the five routed models above plus `grok-4.7`:

- `gpt-5.6-luna`
- `gpt-6-luna`
- `grok-4.6`
- `grok-4.7`
- `muse-spark-1.3-contributor`
- `muse-spark-1.2-contributor`

Include `grok-4.7` even though it is not yet in Zoo Code's routing set, following [issue #1996](https://github.com/Zoo-Code-Org/Zoo-Code/issues/1996) and xAI's official Responses documentation. If the gateway does not serve it when tested, report it as unavailable; do not classify that as a temperature failure.

## Official Temperature Documentation

Reviewed 2026-10-13. These references describe the vendors' published APIs. They do not establish that OpenCode Go forwards or applies a parameter; that remains an empirical question for the POC. Where a model page does not specify the temperature range, use the official Responses API's `0–2` range as a probe bound only, not as evidence of model support.

| Model                        | Published temperature support and constraints                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `gpt-5.6-luna`               | [OpenAI's model page](https://developers.openai.com/api/docs/models/gpt-5.6-luna) lists `reasoning.effort` values including `none`, but does not state whether temperature or `top_p` is accepted at particular efforts. The [general Responses API reference](https://developers.openai.com/api/reference/resources/responses/methods/create) documents temperature as 0–2 (default 1) and `top_p` as an alternative (default 1), recommending changing one rather than both. Use 0–2 as the temperature probe range, not a model-specific guarantee.                                                                                 |
| `gpt-6-luna`                 | [OpenAI's model page](https://developers.openai.com/api/docs/models/gpt-6-luna) lists `none` as a supported effort. [OpenAI's GPT-6 migration guidance](https://developers.openai.com/api/docs/guides/latest-model) says to omit temperature and `top_p` whenever effort is not `none`; thus `none` is the only documented effort at which either may be sent. At `none`, the general API reference recommends changing temperature or `top_p`, not both; the exact pair behavior is undocumented. General temperature range: 0–2.                                                                                                     |
| `grok-4.6`                   | [xAI's Responses API reference](https://docs.x.ai/developers/rest-api-reference/inference/responses) documents temperature 0–2 and `top_p` as an alternative, recommending changing one or the other, not both. [xAI's reasoning documentation](https://docs.x.ai/developers/model-capabilities/text/reasoning) says Grok 4.6 cannot disable reasoning and lists `low`, `medium`, `high`, and `xhigh`; it does not specify a temperature-by-effort compatibility rule.                                                                                                                                                                 |
| `grok-4.7`                   | The same [xAI Responses API](https://docs.x.ai/developers/rest-api-reference/inference/responses) documents temperature 0–2 and recommends changing temperature or `top_p`, not both. [xAI's reasoning documentation](https://docs.x.ai/developers/model-capabilities/text/reasoning) says reasoning cannot be disabled and lists `low`, `medium`, `high`, and `xhigh`; no temperature-by-effort condition is stated.                                                                                                                                                                                                                  |
| `muse-spark-1.3-contributor` | Meta's [Responses API guide](https://dev.meta.ai/docs/protocols/responses) explicitly accepts temperature and `top_p`; its [temperature quickstart](https://dev.meta.ai/docs/cookbook/quickstart-chat-completions) specifies temperature 0–2 (default 1.0), and says to change temperature or `top_p`, not both. The default is tuned to perform best. The [model catalog](https://dev.meta.ai/docs/models) lists this Contributor ID; the temperature example uses Standard Muse Spark 1.3, and no Contributor-specific sampling difference is documented. `none` reasoning is rejected; `max` is Standard 1.3 only, not Contributor. |
| `muse-spark-1.2-contributor` | Meta's [Responses API guide](https://dev.meta.ai/docs/protocols/responses) accepts temperature and `top_p`; the [temperature quickstart](https://dev.meta.ai/docs/cookbook/quickstart-chat-completions) specifies temperature 0–2 (default 1.0), and says to change one sampling parameter at a time. The [model catalog](https://dev.meta.ai/docs/models) lists this Contributor ID; no Contributor-specific sampling difference is documented. `none` reasoning is rejected, and `max` is unavailable to Contributor models.                                                                                                         |

For `gpt-5.6-luna`, OpenAI's current model-specific documentation leaves the temperature/effort relationship unstated. Microsoft's [Azure OpenAI reasoning guidance](https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/reasoning) describes unsupported sampling parameters for its reasoning-model deployments; treat that as Azure-specific rather than as a rule for OpenAI or OpenCode Go.
