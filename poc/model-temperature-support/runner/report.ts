import { readFile, readdir, writeFile } from "node:fs/promises"
import { basename, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { select } from "@inquirer/prompts"

import { loadPromptCases } from "./cases.js"
import { getProvider } from "./providers.js"

const RESULTS_ROOT = fileURLToPath(new URL("../results/generated/", import.meta.url))
const MATRIX_NAME = "results-matrix.html"
const EVIDENCE_NAME = "results-evidence.html"

type CellTemperature = string | null
type Row = Record<string, string>

interface ModelManifest {
	id: string
	reasoningEfforts: string[]
}

interface Manifest {
	runId: string
	status: string
	startedAt: string
	completedAt?: string
	providerId: string
	apiFormat: string
	models: ModelManifest[]
	temperatures: number[]
	promptCaseIds: string[]
}

interface CaseView {
	title: string
	subtitle: string
	criterion: string
	prompt: string
}

const CSS = `
:root{color-scheme:light;--canvas:#f6f8fa;--surface:#fff;--subtle:#f6f8fa;--border:#d1d9e0;--muted:#59636e;--text:#1f2328;--green:#1a7f37;--green-bg:#dafbe1;--gray:#8c959f;--accent:#0969da;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}*{box-sizing:border-box}body{margin:0;background:var(--canvas);color:var(--text);font-size:14px;line-height:1.5}.page{width:min(1320px,100%);margin:auto;padding:34px 28px 52px}.masthead{display:flex;align-items:center;justify-content:space-between;gap:24px;margin-bottom:24px}.brand{display:flex;align-items:center;gap:16px}.brand-mark{width:54px;height:54px;overflow:hidden;border:1px solid #1f232833;border-radius:15px;background:#1f2328}.brand-mark img{width:100%;height:100%;object-fit:contain}.eyebrow{margin:0 0 3px;color:var(--muted);font-size:11px;font-weight:700;letter-spacing:.095em;text-transform:uppercase}h1{margin:0;font-size:clamp(23px,3vw,31px);line-height:1.15}.subtitle{margin:6px 0 0;color:var(--muted)}.run-status{padding:7px 11px;border:1px solid var(--border);border-radius:999px;background:var(--surface);color:var(--muted);font-size:12px;font-weight:650}.run-status.warning{border-color:#d4a72c;background:#fff8c5;color:#9a6700}.summary-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px;margin-bottom:18px}.summary-card,.model-section,.method-note{border:1px solid var(--border);border-radius:11px;background:var(--surface);box-shadow:0 1px 2px #1f23280d}.summary-card{min-height:76px;padding:13px 16px}.summary-label{display:block;margin-bottom:3px;color:var(--muted);font-size:11px;font-weight:650;text-transform:uppercase}.summary-value{display:block;overflow-wrap:anywhere;font-size:16px;font-weight:650}.summary-detail{margin-left:5px;color:#6e7781;font-size:12px;font-weight:450}.method-note{margin-bottom:28px;padding:13px 16px;border-left:3px solid var(--accent);color:var(--muted)}.method-note p{margin:3px 0}.model-section{margin-top:26px;padding:21px}.model-heading{display:flex;justify-content:space-between;gap:14px;margin-bottom:17px;padding-bottom:13px;border-bottom:1px solid #e6ebf0}.model-heading h2{margin:0;overflow-wrap:anywhere;font-size:20px}.model-score{color:var(--muted);font-size:12px}.table-grid,.evidence-grid{display:grid;gap:16px}.table-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.evidence-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.table-grid .results-table{min-width:0}.table-grid .results-table th:first-child{width:112px}.result-card,.evidence-card{min-width:0;overflow:hidden;border:1px solid #e6ebf0;border-radius:10px;background:var(--surface)}.card-heading{padding:13px 15px 10px}.card-heading h3,.evidence-card h4{margin:0;font-size:14px}.card-subtitle,.card-criterion{margin:3px 0 0;color:var(--muted);font-size:12px}.card-criterion{color:#6e7781;font-size:11px}.table-scroll{overflow-x:auto}.results-table,.evidence-table{width:100%;border-collapse:collapse;table-layout:fixed}.results-table{min-width:560px}.results-table th,.results-table td,.evidence-table th,.evidence-table td{border-top:1px solid #e6ebf0}.results-table th,.evidence-table th{padding:8px 7px;background:var(--subtle);color:var(--muted);font-size:11px;text-align:center}.results-table th:first-child,.evidence-table th:first-child{width:168px;text-align:left}.results-table tbody th,.evidence-table tbody th{background:#fbfcfd;color:var(--text);font-size:12px;white-space:nowrap}.results-table td{text-align:center}.marker{display:inline-grid;width:26px;height:26px;place-items:center;border-radius:50%;font-size:20px;font-weight:700;cursor:help}.useful{color:var(--green);background:var(--green-bg)}.not-useful,.missing{color:var(--gray);background:#f0f2f4}.table-legend{display:flex;flex-wrap:wrap;gap:12px;padding:10px 14px 12px;color:var(--muted);font-size:11px}.legend-item{display:inline-flex;align-items:center;gap:5px;white-space:nowrap}.legend-mark{display:inline-grid;width:18px;height:18px;place-items:center;border-radius:50%;font-size:13px;font-weight:700}.legend-mark.good{color:var(--green);background:var(--green-bg)}.legend-mark.bad{color:var(--gray);background:#f0f2f4}.temperature-section{margin:18px 0 24px}.temperature-heading{display:flex;align-items:center;gap:10px;margin-bottom:11px;padding-bottom:8px;border-bottom:1px solid #e6ebf0}.temperature-heading h3{margin:0;font-size:16px}.temperature-value{padding:2px 8px;border:1px solid var(--border);border-radius:999px;background:var(--subtle);font-size:12px}.evidence-card h4{padding:12px 14px 0}.evidence-card .card-subtitle,.evidence-card .card-criterion{padding:0 14px}.evidence-table th{text-align:left}.evidence-table td{padding:10px 12px;vertical-align:top;overflow-wrap:anywhere}.response-meta{display:flex;flex-wrap:wrap;gap:6px 9px;margin-bottom:7px;color:var(--muted);font-size:10px}.response-badge{padding:2px 7px;border:1px solid #e6ebf0;border-radius:999px;background:var(--subtle);font-size:10px}.response-badge.useful{border-color:#aceebb}.response-badge.request-error{border-color:#f1c4c0;background:#fff1f0;color:#9a3127}.response-value{margin:0;font:12px/1.55 inherit;white-space:pre-wrap;overflow-wrap:anywhere}.footer{margin-top:28px;padding-top:14px;border-top:1px solid var(--border);color:#6e7781;font-size:11px}@media(max-width:900px){.table-grid,.evidence-grid{grid-template-columns:1fr}}@media(max-width:640px){.page{padding:22px 14px 36px}.masthead{align-items:flex-start;flex-direction:column}.summary-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.model-section{padding:14px 10px}}
`

function text(value: unknown): string {
	return String(value ?? "")
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
}

function attribute(value: unknown): string {
	return text(value).replaceAll('"', "&quot;").replaceAll("'", "&#39;").replaceAll("\n", "&#10;")
}

function message(error: unknown): string {
	return error instanceof Error ? error.message : String(error)
}

function value(row: Row, field: string): string {
	return row[field] ?? ""
}

function formatTemperature(value: string | number): string {
	const number = Number(value)
	if (!Number.isFinite(number)) throw new Error(`Invalid temperature value: ${value}`)
	return Number.isInteger(number) ? String(number) : number.toFixed(2).replace(/0+$/, "").replace(/\.$/, "")
}

function formatDuration(value: string): string {
	if (!value.trim() || !Number.isFinite(Number(value))) return "Not measured"
	const milliseconds = Number(value)
	const rounded = `${Math.round(milliseconds).toLocaleString()} ms`
	return milliseconds >= 1000 ? `${(milliseconds / 1000).toFixed(2)} s (${rounded})` : rounded
}

function parseCsv(source: string): Row[] {
	const records: string[][] = []
	let record: string[] = [],
		cell = "",
		quoted = false
	for (let index = 0; index < source.length; index += 1) {
		const character = source[index]
		if (quoted) {
			if (character === '"' && source[index + 1] === '"') {
				cell += '"'
				index += 1
			} else if (character === '"') quoted = false
			else cell += character
		} else if (character === '"' && cell.length === 0) quoted = true
		else if (character === ",") {
			record.push(cell)
			cell = ""
		} else if (character === "\n") {
			record.push(cell.replace(/\r$/, ""))
			records.push(record)
			record = []
			cell = ""
		} else cell += character
	}
	if (quoted) throw new Error("Unterminated quoted CSV field")
	if (cell.length || record.length) {
		record.push(cell)
		records.push(record)
	}
	const headers = records.shift() ?? []
	if (headers.length === 0 || headers.some((header) => !header)) throw new Error("outcomes.csv has no valid header")
	return records
		.filter((values) => values.some(Boolean))
		.map((values) => Object.fromEntries(headers.map((header, i) => [header, values[i] ?? ""])))
}

function isManifest(value: unknown): value is Manifest {
	if (!value || typeof value !== "object") return false
	const candidate = value as Partial<Manifest>
	return (
		typeof candidate.runId === "string" &&
		typeof candidate.providerId === "string" &&
		typeof candidate.apiFormat === "string" &&
		typeof candidate.startedAt === "string" &&
		Array.isArray(candidate.models) &&
		Array.isArray(candidate.temperatures) &&
		Array.isArray(candidate.promptCaseIds)
	)
}

async function readManifest(runDirectory: string): Promise<Manifest> {
	const parsed: unknown = JSON.parse(await readFile(join(runDirectory, "manifest.json"), "utf8"))
	if (!isManifest(parsed)) throw new Error(`Invalid manifest.json in ${runDirectory}`)
	return parsed
}

export async function discoverRuns(resultsRoot = RESULTS_ROOT): Promise<string[]> {
	const entries = await readdir(resultsRoot, { withFileTypes: true })
	const runs: string[] = []
	for (const entry of entries) {
		if (!entry.isDirectory()) continue
		try {
			await readManifest(join(resultsRoot, entry.name))
			runs.push(join(resultsRoot, entry.name))
		} catch {
			/* Ignore incomplete/non-run directories. */
		}
	}
	return runs.sort((left, right) => basename(right).localeCompare(basename(left)))
}

async function selectRun(argument: string | undefined): Promise<string> {
	if (argument) {
		const runDirectory = resolve(argument)
		await readManifest(runDirectory)
		return runDirectory
	}
	const runs = await discoverRuns()
	if (runs.length === 0) throw new Error(`No generated run manifests found in ${RESULTS_ROOT}`)
	const newestRun = runs[0]
	if (!newestRun) throw new Error("No generated runs are available for selection")
	const selected = await select({
		message: "Select a generated run for the report",
		choices: runs.map((runDirectory) => ({ name: basename(runDirectory), value: runDirectory })),
		default: newestRun,
	})
	return selected
}

function responseBody(transcript: string): string {
	const lines = transcript.split(/\r?\n/)
	let responseIndex = -1
	for (let index = 0; index < lines.length; index += 1)
		if (/^HTTP\/\S+\s+\d{3}(?:\s|$)/.test(lines[index] ?? "")) responseIndex = index
	if (responseIndex < 0) return ""
	const separator = lines.findIndex((line, index) => index > responseIndex && line === "")
	return separator < 0 ? "" : lines.slice(separator + 1).join("\n")
}

async function outputFor(runDirectory: string, row: Row): Promise<string> {
	let output = ""
	if (value(row, "rawHttpFile"))
		output = responseBody(await readFile(join(runDirectory, value(row, "rawHttpFile")), "utf8"))
	if (output.trim()) {
		try {
			const payload: unknown = JSON.parse(output)
			if (typeof payload === "string") return payload
			if (payload && typeof payload === "object") {
				const object = payload as Record<string, unknown>
				if (typeof object.output_text === "string") return object.output_text
				const chunks: string[] = []
				if (Array.isArray(object.output))
					for (const item of object.output)
						if (item && typeof item === "object") {
							const value = item as Record<string, unknown>
							if (typeof value.text === "string") chunks.push(value.text)
							if (Array.isArray(value.content))
								for (const part of value.content)
									if (part && typeof part === "object") {
										const content = part as Record<string, unknown>
										for (const key of ["text", "refusal", "refusal_text"])
											if (typeof content[key] === "string") chunks.push(content[key] as string)
									}
						}
				if (chunks.length) return chunks.join("\n")
				const error = object.error
				if (typeof error === "string") return `Error: ${error}`
				if (
					error &&
					typeof error === "object" &&
					typeof (error as Record<string, unknown>).message === "string"
				)
					return `Error: ${(error as Record<string, unknown>).message}`
				return JSON.stringify(payload, null, 2)
			}
		} catch {
			/* Preserve non-JSON response bodies. */
		}
		return output.replace(/[\r\n]+$/, "")
	}
	return value(row, "error") || "(No text content in the response.)"
}

function useful(row: Row): boolean {
	return value(row, "usefulResponse").trim().toLowerCase() === "yes"
}
function httpSummary(row: Row): string {
	return value(row, "httpStatus")
		? `HTTP ${value(row, "httpStatus")}`
		: value(row, "executionStatus") === "network_error"
			? "No HTTP response (network error)"
			: "No HTTP response"
}
function httpOk(row: Row): boolean {
	const status = Number(value(row, "httpStatus"))
	return Number.isInteger(status) && status >= 200 && status < 300
}
function key(model: string, caseId: string, effort: string, temperature: CellTemperature): string {
	return JSON.stringify([model, caseId, effort, temperature])
}

async function loadRun(runDirectory: string) {
	const manifest = await readManifest(runDirectory)
	const provider = getProvider(manifest.providerId)
	if (!provider) throw new Error(`Provider ${manifest.providerId} is not present in the local catalog`)
	const rows = parseCsv(await readFile(join(runDirectory, "outcomes.csv"), "utf8"))
	const primary = rows.filter(
		(row) => ["baseline", "temperature"].includes(value(row, "probeKind")) && !value(row, "topP").trim(),
	)
	if (!primary.length) throw new Error("No baseline or temperature-only records were found in outcomes.csv")
	const temperatures = manifest.temperatures.map(formatTemperature)
	const cases = await loadPromptCases(manifest.providerId)
	const caseMap = new Map(cases.map((item) => [item.id, item]))
	const views = new Map<string, CaseView>()
	for (const id of manifest.promptCaseIds) {
		const definition = caseMap.get(id)
		if (!definition) throw new Error(`Prompt case ${id} is missing from the provider case file`)
		const criterion =
			definition.usefulResponse.type === "non-empty-text"
				? "Useful when the response contains non-empty text."
				: `Useful when the response matches /${definition.usefulResponse.pattern}/.`
		views.set(id, {
			title: id.includes("arithmetic")
				? "Arithmetic question"
				: id.includes("subjective")
					? "Text question"
					: definition.name,
			subtitle: definition.name,
			criterion,
			prompt: definition.prompt,
		})
	}
	const records = new Map<string, Row>()
	for (const row of primary) {
		const temperature = value(row, "probeKind") === "baseline" ? null : formatTemperature(value(row, "temperature"))
		const coordinate = key(value(row, "modelId"), value(row, "caseId"), value(row, "reasoningEffort"), temperature)
		if (records.has(coordinate)) throw new Error(`Duplicate baseline/temperature result for ${coordinate}`)
		records.set(coordinate, row)
	}
	for (const model of manifest.models)
		for (const caseId of manifest.promptCaseIds)
			for (const effort of model.reasoningEfforts)
				for (const temperature of [null, ...temperatures])
					if (!records.has(key(model.id, caseId, effort, temperature)))
						throw new Error(
							`Missing result for ${model.id} / ${caseId} / ${effort} / ${temperature ?? "omitted"}`,
						)
	const outputs = new Map<string, string>()
	for (const row of primary) outputs.set(value(row, "attemptId"), await outputFor(runDirectory, row))
	return { manifest, provider, rows: primary, temperatures, views, records, outputs }
}

function marker(row: Row | undefined, outputs: Map<string, string>): string {
	if (!row) return '<span class="marker missing" role="img" aria-label="No request recorded">–</span>'
	const isUseful = useful(row)
	const output = outputs.get(value(row, "attemptId")) ?? ""
	const title = [
		`HTTP response: ${httpSummary(row)}`,
		`Duration: ${formatDuration(value(row, "responseTimeMs"))}`,
		`Useful response: ${isUseful ? "Yes" : "No"}`,
		"Output:",
		output,
	].join("\n")
	return `<span class="marker ${isUseful ? "useful" : "not-useful"}" role="img" aria-label="${attribute(isUseful ? "Useful response" : "Not useful response")}" title="${attribute(title)}">${isUseful ? "✓" : "×"}</span>`
}

function httpMarker(row: Row | undefined): string {
	if (!row)
		return '<span class="marker not-useful" role="img" aria-label="HTTP error; no request recorded" title="No HTTP response was recorded.">×</span>'
	const ok = httpOk(row)
	return `<span class="marker ${ok ? "useful" : "not-useful"}" role="img" aria-label="${attribute(ok ? "HTTP response OK" : "HTTP response error")}" title="${attribute(httpSummary(row))}">${ok ? "✓" : "×"}</span>`
}

function renderHttpValidityTable(
	data: Awaited<ReturnType<typeof loadRun>>,
	model: ModelManifest,
	conditions: [CellTemperature, string][],
): string {
	const caseId =
		data.manifest.promptCaseIds.find((id) => id.toLowerCase().includes("arithmetic")) ??
		data.manifest.promptCaseIds[0]
	if (!caseId) return ""
	return `<section class="result-card"><div class="card-heading"><h3>Arithmetic HTTP Response</h3><p class="card-subtitle">${text(caseId)}</p><p class="card-criterion">Green indicates a successful 2xx HTTP response; grey indicates an HTTP error or no response.</p></div><div class="table-scroll"><table class="results-table"><thead><tr><th>Thinking level</th>${conditions.map(([value, label]) => `<th title="${attribute(value === null ? "Baseline request; temperature omitted" : `Temperature ${value}`)}">${text(label)}</th>`).join("")}</tr></thead><tbody>${model.reasoningEfforts.map((effort) => `<tr><th scope="row">${text(effort)}</th>${conditions.map(([temperature]) => `<td>${httpMarker(data.records.get(key(model.id, caseId, effort, temperature)))}</td>`).join("")}</tr>`).join("")}</tbody></table></div></section>`
}

function summary(data: Awaited<ReturnType<typeof loadRun>>): string {
	const usefulCount = data.rows.filter(useful).length
	const providerName = data.provider.name
	const cards = [
		["Provider", `${text(providerName)}<span class="summary-detail">${text(data.manifest.apiFormat)} API</span>`],
		["Models tested", String(data.manifest.models.length)],
		["Temperature omitted", String(data.rows.filter((row) => row.probeKind === "baseline").length)],
		["Temperatures tested", String(data.rows.filter((row) => row.probeKind === "temperature").length)],
		[
			"Useful responses",
			`${usefulCount} / ${data.rows.length}<span class="summary-detail">${data.rows.length ? Math.round((usefulCount / data.rows.length) * 100) : 0}%</span>`,
		],
	]
	return `<div class="summary-grid">${cards.map(([label, value]) => `<div class="summary-card"><span class="summary-label">${label}</span><span class="summary-value">${value}</span></div>`).join("")}</div>`
}

function startPage(title: string, subtitle: string, data: Awaited<ReturnType<typeof loadRun>>): string {
	const statusClass = data.manifest.status === "completed-with-errors" ? "warning" : ""
	return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${text(title)}</title><style>${CSS}</style></head><body><main class="page"><header class="masthead"><div><p class="eyebrow">Model temperature study</p><h1>${text(title)}</h1><p class="subtitle">${text(subtitle)}</p></div><span class="run-status ${statusClass}">${text(data.manifest.status)}</span></header>${summary(data)}<div class="method-note"><strong>Run details</strong><p>${text(data.provider.name)} · ${text(data.manifest.apiFormat)} API · run ${text(data.manifest.runId)}.</p><p>“Omitted” is the baseline request; numeric columns are temperature-only probes. Separate top-p compatibility checks are excluded.</p></div>`
}

function endPage(): string {
	return `<footer class="footer">Report generated from this run’s outcomes and redacted HTTP transcripts. Timings and usefulness flags are recorded runner values; response text is shown as returned.</footer></main></body></html>`
}

function renderMatrix(data: Awaited<ReturnType<typeof loadRun>>): string {
	const conditions: [CellTemperature, string][] = [
		[null, "Omitted"],
		...data.temperatures.map((temperature) => [temperature, temperature] as [string, string]),
	]
	let html = startPage(
		"Temperature support matrix",
		"Useful responses by model, temperature, and thinking level.",
		data,
	)
	html += `<aside class="method-note"><strong>Reading the matrix</strong><p>✓ Useful means the prompt-specific rule passed; × Not useful covers unusable responses and request failures. Hover an icon for status, duration, usefulness, and output.</p></aside>`
	for (const model of data.manifest.models) {
		const modelRows = data.rows.filter((row) => value(row, "modelId") === model.id)
		html += `<section class="model-section"><div class="model-heading"><h2>${text(model.id)}</h2><span class="model-score">${modelRows.filter(useful).length} / ${modelRows.length} useful</span></div><div class="table-grid">`
		html += renderHttpValidityTable(data, model, conditions)
		for (const caseId of data.manifest.promptCaseIds) {
			const view = data.views.get(caseId)
			if (!view) continue
			html += `<section class="result-card"><div class="card-heading"><h3>${text(view.title)}</h3><p class="card-subtitle">${text(view.subtitle)}</p><p class="card-criterion">${text(view.criterion)}</p></div><div class="table-scroll"><table class="results-table"><thead><tr><th>Thinking level</th>${conditions.map(([value, label]) => `<th title="${attribute(value === null ? "Baseline request; temperature omitted" : `Temperature ${value}`)}">${text(label)}</th>`).join("")}</tr></thead><tbody>`
			for (const effort of model.reasoningEfforts)
				html += `<tr><th scope="row">${text(effort)}</th>${conditions.map(([temperature]) => `<td>${marker(data.records.get(key(model.id, caseId, effort, temperature)), data.outputs)}</td>`).join("")}</tr>`
			html += `</tbody></table></div></section>`
		}
		html += `</div></section>`
	}
	return html + endPage()
}

function renderEvidence(data: Awaited<ReturnType<typeof loadRun>>): string {
	const conditions: [CellTemperature, string][] = [
		[null, "Temperature omitted"],
		...data.temperatures.map((temperature) => [temperature, `Temperature ${temperature}`] as [string, string]),
	]
	let html = startPage(
		"Temperature response evidence",
		"Full recorded response text for every tested temperature and thinking level.",
		data,
	)
	html += `<aside class="method-note"><strong>How to read the evidence</strong><p>Each section preserves the response value or recorded error for every selected model, prompt case, thinking level, and temperature.</p></aside>`
	for (const model of data.manifest.models) {
		html += `<section class="model-section"><div class="model-heading"><h2>${text(model.id)}</h2></div>`
		for (const [temperature, heading] of conditions) {
			html += `<section class="temperature-section"><div class="temperature-heading"><h3>${text(heading)}</h3><span class="temperature-value">${text(temperature === null ? "Baseline · parameter not sent" : temperature)}</span></div><div class="evidence-grid">`
			for (const caseId of data.manifest.promptCaseIds) {
				const view = data.views.get(caseId)
				if (!view) continue
				html += `<section class="evidence-card"><h4>${text(view.title)}</h4><p class="card-subtitle">${text(view.subtitle)}</p><p class="card-criterion">${text(view.criterion)}</p><table class="evidence-table"><thead><tr><th>Thinking level</th><th>Response value</th></tr></thead><tbody>`
				for (const effort of model.reasoningEfforts) {
					const row = data.records.get(key(model.id, caseId, effort, temperature))
					const output = row
						? (data.outputs.get(value(row, "attemptId")) ?? "")
						: "(No request result was recorded.)"
					const badge =
						!row ||
						value(row, "executionStatus") === "http_error" ||
						value(row, "executionStatus") === "network_error"
							? "Request error"
							: useful(row)
								? "Useful"
								: "Not useful"
					html += `<tr><th scope="row">${text(effort)}</th><td><div class="response-meta"><span class="response-badge ${badge === "Useful" ? "useful" : badge === "Request error" ? "request-error" : ""}">${badge}</span>${row ? `<span>${text(httpSummary(row))}</span><span>${text(formatDuration(value(row, "responseTimeMs")))}</span>` : ""}</div><pre class="response-value">${text(output)}</pre></td></tr>`
				}
				html += `</tbody></table></section>`
			}
			html += `</div></section>`
		}
		html += `</section>`
	}
	return html + endPage()
}

export async function generate(runDirectory: string): Promise<{ matrixPath: string; evidencePath: string }> {
	const data = await loadRun(runDirectory)
	const matrixPath = join(runDirectory, MATRIX_NAME)
	const evidencePath = join(runDirectory, EVIDENCE_NAME)
	await writeFile(matrixPath, renderMatrix(data), "utf8")
	await writeFile(evidencePath, renderEvidence(data), "utf8")
	return { matrixPath, evidencePath }
}

export async function main(args = process.argv.slice(2)): Promise<void> {
	const runDirectory = await selectRun(args[0])
	const result = await generate(runDirectory)
	console.log(`Matrix: ${result.matrixPath}`)
	console.log(`Evidence: ${result.evidencePath}`)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
	void main().catch((error: unknown) => {
		console.error(`Report generation failed: ${message(error)}`)
		process.exitCode = 1
	})

export const reportInternals = { parseCsv, formatTemperature, responseBody, key, text, attribute, discoverRuns, httpOk }
