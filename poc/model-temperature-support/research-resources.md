# Research Resources Considered

Reviewed 2026-10-13. No dedicated, community-accepted standard for testing API temperature acceptance and behavioral effect was identified. Vendor documentation describes published API contracts, not whether the OpenCode Go gateway forwards or applies temperature; that must be established empirically.

## Official model and API documentation

- [OpenAI GPT-5.6 Luna model page](https://developers.openai.com/api/docs/models/gpt-5.6-luna), [GPT-5.6 guidance](https://developers.openai.com/api/docs/guides/latest-model/gpt-5.6.md), [Responses API parameter reference](https://developers.openai.com/api/reference/resources/responses/methods/create), and [reasoning guide](https://developers.openai.com/api/docs/guides/reasoning) — general temperature range/default, `top_p` alternative guidance, and effort values; no GPT-5.6 Luna-specific temperature/effort rule was found.
- [OpenAI GPT-6 Luna model page](https://developers.openai.com/api/docs/models/gpt-6-luna) and [GPT-6 migration guidance](https://developers.openai.com/api/docs/guides/latest-model) — instructs omitting temperature and `top_p` unless reasoning effort is `none`.
- [xAI Responses API reference](https://docs.x.ai/developers/rest-api-reference/inference/responses), [Chat Completions reference](https://docs.x.ai/developers/rest-api-reference/inference/chat-completions), [Grok 4.6](https://docs.x.ai/developers/models/grok-4.6), [Grok 4.7](https://docs.x.ai/developers/models/grok-4.7), and [reasoning documentation](https://docs.x.ai/developers/model-capabilities/text/reasoning) — temperature and `top_p` are documented as alternative sampling controls; changing one rather than both is recommended. Reasoning-effort constraints are listed, but a per-effort temperature rule is not.
- Meta [Responses API](https://dev.meta.ai/docs/protocols/responses), [temperature quickstart](https://dev.meta.ai/docs/cookbook/quickstart-chat-completions), [model catalog](https://dev.meta.ai/docs/models), and [reasoning guidance](https://dev.meta.ai/docs/reasoning) — temperature default/range and explicit direction to change temperature or `top_p`, not both; model IDs and reasoning-effort constraints.
- [Microsoft Foundry reasoning guidance](https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/reasoning) — Azure-specific cross-reference for GPT reasoning model parameters; not treated as a policy for OpenCode Go.

## Secondary lead

- [reAPI: GPT-6 Luna temperature behavior](https://reapi.ai/blog/gpt-6-luna-temperature) — third-party report that reAPI rejects temperature even at `none`; useful as a provider-specific observation, not official OpenAI or OpenCode Go documentation. Referenced by [Zoo Code issue #2006](https://github.com/Zoo-Code-Org/Zoo-Code/issues/2006).

## Methodology resources

These works provide background on evaluating temperature effects. They are retained as references; their diversity and statistical evaluation methods are not part of the planned test outputs.

- [The Effect of Sampling Temperature on Problem Solving in Large Language Models](https://aclanthology.org/2024.findings-emnlp.432/) — Findings of EMNLP 2024. Sweeps temperature across models and prompts, holds other sampling settings fixed, and measures task performance and response variation. [Code and data](https://github.com/matthewrenze/jhu-llm-temperature).
- [Benchmarking Linguistic Diversity of Large Language Models](https://aclanthology.org/2025.tacl-1.69/) — TACL 2025. Provides lexical, syntactic, and semantic diversity measures and analyzes decoding settings, including temperature.
- [Towards Reproducible LLM Evaluation: Quantifying Uncertainty in LLM Benchmark Scores](https://arxiv.org/abs/2410.03492) — Preprint. Discusses repeated runs, uncertainty intervals, and recording experimental conditions; notes that temperature zero does not guarantee deterministic API responses.
- [HELM](https://crfm.stanford.edu/helm/) ([repository](https://github.com/stanford-crfm/helm)) — Stanford CRFM's general evaluation framework. Useful precedent for transparent, standardized, multi-metric comparisons; not a temperature-specific benchmark.
