# Model-temperature report generator discovery

## Decision record

The report generator belongs in the self-contained `poc/model-temperature-support` package. The existing Python file is a useful visual and validation prototype, but the maintained implementation will be TypeScript so the package's existing pnpm/TypeScript workflow is sufficient and no Python runtime is required.

The test runner's current optional selections do not make reporting materially harder. The manifest records the selected thinking levels and temperatures, and the report can build its coordinate set from those values. No runner behavior change is planned.

## Source-of-truth boundaries

- The manifest defines the selected run scope.
- The outcomes CSV defines request status, usefulness, timing, and transcript references.
- Redacted HTTP transcripts define displayed response content.
- The provider catalog supplies display names and API format.
- The provider case file supplies prompt labels, prompts, and usefulness criteria.

Top-p compatibility and diagnostic rows are deliberately excluded from the primary matrix/evidence grid because the prototype reports temperature support, not every auxiliary probe.

## Planned interface

- Interactive: `pnpm --dir poc/model-temperature-support report`
- Direct: `pnpm --dir poc/model-temperature-support report <generated-run-directory>`
- Outputs: `results-matrix.html` and `results-evidence.html` in the selected run directory.

## Risks and mitigations

- CSV values and HTTP response bodies can contain quoting, markup, or arbitrary text. Use a real local parser and escape every HTML text/attribute value.
- A partially completed run may have missing coordinates. Validate against the manifest and render only after either complete data or an explicit, tested missing-cell policy; the initial plan is to fail clearly for missing primary coordinates.
- Run-specific narrative in the prototype can become false for later runs. Keep generated explanatory text generic and derive all factual values from the selected run.
