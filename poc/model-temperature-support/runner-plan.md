# Lite Runner Plan

## Goal

Run a small, catalogued matrix of temperature requests against a selected provider gateway and record which requests return useful prompt responses. Keep this POC self-contained and focused on temperature request outcomes; do not import Zoo Code code or packages.

## Configuration

- Maintain provider connection definitions and provider-scoped model definitions inside the POC. Session model selection is limited to the local catalog.
- Keep JSON prompt cases separate from provider and model configuration. Cases may use an explicit regex criterion for constrained-answer checks or a `non-empty-text` criterion for open-ended prompts that accept any non-blank response. The initial OpenCode Go cases include a subjective question about what blue feels like to invite free-form variation across temperature values. This criterion is not a semantic-quality or diversity score.
- Start with the OpenCode Go Responses models and planned Grok 4.7 target in the [model catalog plan](./model-catalog-plan.md). Preserve its capability documentation and links as research evidence.
- Keep provider and model definitions straightforward; defer generic inheritance or abstractions until another provider or model makes them necessary.

## One-Shot Run

1. Start one runner invocation, select a provider and catalogued models, and enter the provider credential once using a masked prompt.
2. Select thinking levels, temperature values, prompt cases, and the limited `top_p` compatibility check. When a model-specific temperature range is undocumented, use the official Responses API range `0–2` as a probe bound only.
3. For each selected test condition, send its planned direct HTTP request to the selected gateway once and assign that request its own unique gateway session ID. Never reuse a gateway session across test conditions. Wait one second between actual gateway requests to reduce throttling; do not wait before the first request or count probes skipped without sending as requests. Test temperature with `top_p` omitted; perform any paired `temperature`/`top_p` compatibility probe separately. Never automatically or interactively rerun a failed test. A separate `top_p`-only diagnostic is a distinct test condition and gets its own session; it is not a retry of the failed paired request.
4. Record each HTTP outcome and determine `Useful response? Yes/No` against that prompt's criterion. An HTTP success with empty or unusable content is `No`. Record failures as final outcomes for their attempts and continue through the remaining selected tests without a retry prompt.
5. After all selected tests and any distinct planned diagnostic probes finish, finalize the run records, print the result summary (including the failure count when applicable), and return from the runner so its command session closes. Test request failures are expected outcomes and do not set a non-zero process exit code; reserve non-zero exits for runner/setup/runtime errors. Do not leave it waiting for retry input or offer an in-session resume flow.

There is no persistent runner-command session or resume workflow. One invocation processes the selected matrix, but each individual HTTP test request uses a fresh gateway session that is not reused. Completed requests are retained in the run records, and starting a new invocation starts a new run.

## Run Records

- Create a unique directory under `results/generated/` for each invocation, with a manifest containing the provider, selected models, test scope, and run metadata. Never put credentials in the manifest or results.
- Save the runner's console status output in a readable `runner.log` alongside the manifest, CSV, and raw HTTP evidence. Do not log the masked credential or secret values.
- Save each request and response as raw HTTP evidence, replacing the authorization credential with the static placeholder `<REDACTED_API_TOKEN>` before writing it.
- Write one normalized `outcomes.csv` row per sent request attempt, including provider, model, API format, prompt/test ID, thinking level, requested temperature, `top_p` condition, response time in milliseconds, HTTP status, useful-response result, and raw-evidence reference. Response time is measured locally using a monotonic clock as end time minus start time, from just before the HTTP request until the full response body is read; it does not use server-provided timestamps and excludes inter-request pacing delay. Record elapsed time for HTTP and network failures too. Keep documented or otherwise skipped probes as not-run rows, with no attempt number or response time (`attemptNumber` and `responseTimeMs` empty in CSV).
- Preserve each open-ended response verbatim in its redacted raw HTTP transcript. Analyze output differences separately across temperatures; the binary useful-response field only indicates non-blank text for `non-empty-text` cases.
- Keep `top_p` compatibility records identifiable and separate from primary temperature-only cases.

## Analysis Boundary

The runner produces raw HTTP evidence and CSV outcomes only. A person may provide those records to an LLM to draft reports; the records remain the source of truth. After the test run, a separate follow-up compares the outcome matrix with the then-current Zoo Code model metadata and settings UI, then recommends subtasks for issue #2006.
