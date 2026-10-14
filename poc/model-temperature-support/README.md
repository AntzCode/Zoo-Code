# Model Temperature Support

A one-shot runner for testing temperature request outcomes across model gateways and recording CSV/HTTP evidence for later analysis. Outcomes include request response time in milliseconds, measured locally with a monotonic clock from request start until the full response body is received (not from server timestamps and excluding the pause between requests). The runner waits one second between actual gateway requests to reduce throttling. Prompt cases support constrained regex checks and open-ended, non-blank text responses for comparing output variation across temperature values. Each selected test request uses its own gateway session and gets one attempt; failures are recorded and never retried. Failed test outcomes are reported in the results but do not make the command exit unsuccessfully; setup or unexpected runner errors still return a non-zero exit code. After all selected tests finish, the runner prints the result message and exits its command session. Each run also saves the readable console status output to `runner.log` beside its other records.

Run from this directory with `pnpm install` followed by `pnpm start`. The runner prompts for the provider credential and writes each run under `results/generated/`.

- `cases/` — JSON definitions for model and temperature test inputs.
- `runner/` — Runs the configured request matrix and records outcomes.
- `results/` — Curated findings and reports; generated run output is ignored.
