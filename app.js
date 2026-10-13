import { formatNumber, originalTaxa, readReportFile, recommendations, selectedTaxa, validateReport } from './report.js';

const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
const icon = { order: '◈', family: '⌘', genus: '✿', species: '✧' };
const state = { report: null, stage: 0, thresholds: {}, gene: null, demo: false };

function setStatus(message, error = false) {
  $('#status').textContent = message;
  $('#status').className = message ? (error ? 'status error' : 'status') : '';
}

function stage() { return state.report.stages[state.stage]; }

function threshold() { return state.thresholds[stage().id]; }

function loadReport(report, demo = false) {
  state.report = validateReport(report);
  state.stage = 0;
  state.demo = demo;
  state.gene = null;
  state.thresholds = Object.fromEntries(report.stages.map(item => [item.id, Number(item.default_z) || 0]));
  $('#emptyState').hidden = true;
  $('#reportView').hidden = false;
  $('#taxonSearch').value = '';
  setStatus(demo ? 'Synthetic demo data — not an identification result.' : 'Report loaded. Your data remains on this device.');
  render();
  $('#reportView').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderTabs() {
  $('#stageTabs').innerHTML = state.report.stages.map((item, index) =>
    `<button type="button" class="stage-tab ${index === state.stage ? 'active' : ''}" data-stage="${index}" aria-current="${index === state.stage ? 'page' : 'false'}"><span class="tab-icon">${icon[item.level] || '○'}</span><span>${esc(item.id === 'branch' ? 'Branch screen' : item.id)}</span><small>${esc(item.level)}</small></button>`
  ).join('');
  $('#stageTabs').querySelectorAll('button').forEach(button => button.addEventListener('click', () => {
    state.stage = Number(button.dataset.stage);
    state.gene = null;
    $('#taxonSearch').value = '';
    render();
  }));
}

function renderMetrics(item) {
  const selected = selectedTaxa(item, threshold());
  const cards = [
    ['◈', 'Candidates at this Z', selected.length, `${item.predictions.length} ranked taxa`],
    ['⌁', 'Genes with evidence', item.genes.length, `${item.counts?.requested_genes || '—'} requested genes`],
    ['⋈', 'Query exons', item.counts?.query_exons || 0, 'nearest-reference comparisons'],
    ['✿', 'Reference taxa', item.counts?.reference_taxa || '—', 'represented in trees'],
  ];
  $('#metricCards').innerHTML = cards.map(([symbol, label, value, detail]) =>
    `<div class="metric-card"><span class="metric-icon" aria-hidden="true">${symbol}</span><span class="metric-label">${esc(label)}</span><strong>${esc(value)}</strong><small>${esc(detail)}</small></div>`
  ).join('');
}

function renderChart(item) {
  const top = item.predictions.slice(0, 12);
  const max = Math.max(...top.map(row => row.score || 0), 1);
  const current = new Set(selectedTaxa(item, threshold()).map(row => row.taxon));
  $('#rankingChart').innerHTML = top.map(row => {
    const width = Math.max(1, Math.min(100, ((row.score || 0) / max) * 100));
    const active = current.has(row.taxon);
    return `<div class="bar-row"><span class="bar-name" title="${esc(row.taxon)}">${esc(row.taxon)}</span><div class="bar-track"><div class="bar-fill ${active ? 'active' : ''}" style="width:${width.toFixed(2)}%"></div></div><span class="bar-value">${formatNumber(row.score, 1)}</span><span class="bar-z ${active ? 'active' : ''}">Z ${formatNumber(row.z_score, 1)}</span></div>`;
  }).join('');
}

function renderTable(item) {
  const needle = $('#taxonSearch').value.trim().toLocaleLowerCase();
  const matching = item.predictions.filter(row => row.taxon.toLocaleLowerCase().includes(needle));
  const current = new Set(selectedTaxa(item, threshold()).map(row => row.taxon));
  $('#rankingRows').innerHTML = matching.slice(0, 500).map(row => {
    const live = current.has(row.taxon);
    const original = row.pipeline_selected;
    const label = live && original ? 'Both' : live ? 'Z selected' : original ? 'Pipeline only' : '—';
    return `<tr><td>${esc(row.rank)}</td><td class="taxon-name">${esc(row.taxon)}</td><td>${formatNumber(row.score, 3)}</td><td>${formatNumber(row.z_score, 2)}</td><td>${esc(row.locus_votes || 0)}</td><td><span class="result-pill ${live ? 'positive' : original ? 'pipeline' : ''}">${label}</span></td></tr>`;
  }).join('') || '<tr><td colspan="6" class="no-data">No matching taxa.</td></tr>';
  if (matching.length > 500) $('#rankingRows').insertAdjacentHTML('beforeend', `<tr><td colspan="6" class="no-data">Showing the first 500 of ${matching.length} matches. Refine your search to see more.</td></tr>`);
}

function renderGenes(item) {
  const container = $('#geneContent');
  if (!item.evidence_available || !item.genes.length) {
    container.innerHTML = '<div class="gene-empty"><span aria-hidden="true">⌁</span><strong>Gene evidence not in this report</strong><p>The original per-gene matrices were unavailable when this file was created. Re-export during a new run to inspect individual loci.</p></div>';
    return;
  }
  const genes = [...item.genes].sort((a, b) => Number(b.query_exons) - Number(a.query_exons) || a.gene.localeCompare(b.gene));
  if (!state.gene || !genes.some(gene => gene.gene === state.gene)) state.gene = genes[0].gene;
  const gene = genes.find(entry => entry.gene === state.gene);
  const options = genes.map(entry => `<option value="${esc(entry.gene)}" ${entry.gene === state.gene ? 'selected' : ''}>Gene ${esc(entry.gene)} · ${esc(entry.query_exons)} query exons</option>`).join('');
  const matches = gene.matches.slice(0, 30);
  const maxVotes = Math.max(1, ...matches.map(entry => entry.query_votes));
  const evidence = matches.map(entry => `<div class="gene-match"><div><strong>${esc(entry.taxon)}</strong><small>${esc(entry.query_votes)} query votes · median distance ${formatNumber(entry.median_distance, 4)}</small></div><div class="gene-votes"><span style="width:${Math.max(3, 100 * entry.query_votes / maxVotes).toFixed(1)}%"></span></div><code title="Example nearest reference">${esc(entry.example_reference)}</code></div>`).join('') || '<p class="no-data">No nearest-reference match was recorded.</p>';
  container.innerHTML = `<div class="gene-toolbar"><label for="geneSelect">Choose a gene</label><select id="geneSelect">${options}</select><span>${esc(gene.trees)} tree${gene.trees === 1 ? '' : 's'} · ${esc(gene.query_exons)} query exons</span></div><div class="gene-matches">${evidence}</div>`;
  $('#geneSelect').addEventListener('change', event => { state.gene = event.target.value; renderGenes(item); });
}

function renderControls(item) {
  const values = item.predictions.map(row => row.z_score).filter(Number.isFinite);
  const min = Math.floor(Math.min(-2, ...values) * 2) / 2;
  const max = Math.ceil(Math.max(5, ...values) * 2) / 2;
  const input = $('#zInput');
  input.min = min;
  input.max = max;
  input.value = threshold();
  $('#zValue').textContent = formatNumber(threshold(), 1);
  document.querySelector('.range-labels').innerHTML = `<span>${formatNumber(min, 1)}</span><span>${formatNumber(max, 1)}</span>`;
  const selected = selectedTaxa(item, threshold());
  const original = originalTaxa(item);
  $('#thresholdNote').textContent = `${selected.length} pass this Z setting · ${original.length} were selected by the original pipeline`;
  $('#selectedList').innerHTML = selected.length ? selected.slice(0, 30).map(row => `<span class="taxon-chip"><span aria-hidden="true">✿</span>${esc(row.taxon)}</span>`).join('') : '<span class="no-selection">No taxa at this threshold</span>';
}

function renderAdvice(item) {
  $('#adviceContent').innerHTML = recommendations(item, threshold()).map((tip, index) =>
    `<div class="advice-item"><span class="advice-number">${String(index + 1).padStart(2, '0')}</span><p>${esc(tip)}</p></div>`
  ).join('');
}

function renderProvenance(item) {
  const data = [
    ['Sample', state.report.sample_id],
    ['Stage', item.id],
    ['Analysis level', item.level],
    ['Original Z cutoff', formatNumber(item.default_z, 1)],
    ['Matrices summarized', item.counts?.matrices ?? '—'],
    ['Per-gene evidence', item.evidence_available ? 'Included' : 'Not included'],
    ['Created', state.report.generated_at ? new Date(state.report.generated_at).toLocaleString() : '—'],
    ['Schema', state.report.schema_version],
  ];
  $('#provenance').innerHTML = data.map(([label, value]) => `<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join('');
}

function render() {
  const item = stage();
  $('#sampleName').textContent = state.report.sample_id;
  $('#reportMeta').textContent = `${state.report.stages.length} analysis stage${state.report.stages.length === 1 ? '' : 's'} · ${state.demo ? 'Synthetic demonstration' : 'Portable SPrOUT result'}`;
  renderTabs(); renderMetrics(item); renderChart(item); renderTable(item); renderGenes(item);
  renderControls(item); renderAdvice(item); renderProvenance(item);
}

async function handleFile(file) {
  try { loadReport(await readReportFile(file)); }
  catch (error) { setStatus(error.message, true); }
}

async function loadDemo() {
  try {
    const response = await fetch('./examples/demo.pea.json');
    if (!response.ok) throw new Error('Could not load the demonstration.');
    loadReport(await response.json(), true);
  } catch (error) { setStatus(error.message, true); }
}

$('#fileInput').addEventListener('change', event => { if (event.target.files[0]) handleFile(event.target.files[0]); });
$('#demoButton').addEventListener('click', loadDemo);
$('#emptyDemoButton').addEventListener('click', loadDemo);
$('#taxonSearch').addEventListener('input', () => { if (state.report) renderTable(stage()); });
$('#zInput').addEventListener('input', event => {
  if (!state.report) return;
  state.thresholds[stage().id] = Number(event.target.value);
  const item = stage();
  renderMetrics(item); renderChart(item); renderTable(item); renderControls(item); renderAdvice(item);
});
$('#downloadButton').addEventListener('click', () => {
  if (!state.report) return;
  const item = stage();
  const names = selectedTaxa(item, threshold()).map(row => row.taxon);
  const blob = new Blob([names.join('\n') + (names.length ? '\n' : '')], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${state.report.sample_id}.${item.id}.z-${threshold().toFixed(1)}.candidates.txt`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

const dropzone = $('#emptyState');
for (const eventName of ['dragenter', 'dragover']) dropzone.addEventListener(eventName, event => { event.preventDefault(); dropzone.classList.add('dragging'); });
for (const eventName of ['dragleave', 'drop']) dropzone.addEventListener(eventName, event => { event.preventDefault(); dropzone.classList.remove('dragging'); });
dropzone.addEventListener('drop', event => { if (event.dataTransfer.files[0]) handleFile(event.dataTransfer.files[0]); });
