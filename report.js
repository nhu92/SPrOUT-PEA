export const SCHEMA = 'sprout-pea/v1';
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_JSON_BYTES = 20 * 1024 * 1024;

function validateTree(root) {
  if (!root || typeof root !== 'object') throw new Error('Invalid tree topology.');
  const stack = [[root, 0]];
  let nodes = 0;
  while (stack.length) {
    const [node, depth] = stack.pop();
    if (++nodes > 500 || depth > 150 || !Number.isFinite(node.l) || node.l < 0 ||
        (node.n !== undefined && (typeof node.n !== 'string' || node.n.length > 300)) ||
        (node.t !== undefined && node.t !== null && (typeof node.t !== 'string' || node.t.length > 200)) ||
        (node.c !== undefined && (!Array.isArray(node.c) || node.c.length > 100))) {
      throw new Error('The report has an invalid or oversized tree.');
    }
    for (const child of node.c || []) stack.push([child, depth + 1]);
  }
}

export function validateReport(value) {
  if (!value || value.schema_version !== SCHEMA || typeof value.sample_id !== 'string' ||
      !value.sample_id || !Array.isArray(value.stages) || !value.stages.length || value.stages.length > 20) {
    throw new Error('This is not a supported SPrOUT-PEA v1 report.');
  }
  const seen = new Set();
  for (const stage of value.stages) {
    if (!stage || !['order', 'family', 'genus', 'species'].includes(stage.level) ||
        typeof stage.id !== 'string' || seen.has(stage.id) ||
        !Array.isArray(stage.predictions) || !stage.predictions.length || stage.predictions.length > 10000 ||
        !Array.isArray(stage.genes) || stage.genes.length > 2000) {
      throw new Error('The report has an invalid stage or exceeds the supported limits.');
    }
    seen.add(stage.id);
    for (const row of stage.predictions) {
      if (typeof row?.taxon !== 'string' || !row.taxon || row.taxon.length > 200 ||
          (row.z_score !== null && !Number.isFinite(row.z_score)) ||
          (row.score !== null && !Number.isFinite(row.score))) {
        throw new Error(`Invalid prediction in ${stage.id}.`);
      }
    }
    for (const gene of stage.genes) {
      if (typeof gene?.gene !== 'string' || !Array.isArray(gene.matches) || gene.matches.length > 1000) {
        throw new Error(`Invalid gene evidence in ${stage.id}.`);
      }
      if (gene.exons !== undefined) {
        if (!Array.isArray(gene.exons) || gene.exons.length > 100) throw new Error(`Invalid exons in ${stage.id}.`);
        for (const exon of gene.exons) {
          if (typeof exon?.id !== 'string' || !Array.isArray(exon.support) || exon.support.length > 100 ||
              exon.support.some(row => typeof row.taxon !== 'string' || !Number.isFinite(row.score) || row.score < 0)) {
            throw new Error(`Invalid exon support in ${stage.id}.`);
          }
          if (exon.tree) validateTree(exon.tree);
        }
      }
    }
    if (stage.summary_tree?.tree) validateTree(stage.summary_tree.tree);
  }
  return value;
}

export function selectedTaxa(stage, threshold) {
  return stage.predictions.filter(row => row.z_score !== null && row.z_score > threshold);
}

export function originalTaxa(stage) {
  return stage.predictions.filter(row => row.pipeline_selected);
}

export function formatNumber(value, digits = 2) {
  return value === null || value === undefined || !Number.isFinite(value)
    ? '—' : Number(value).toFixed(digits);
}

export function recommendations(stage, threshold) {
  const tips = [];
  const selected = selectedTaxa(stage, threshold);
  if (!selected.length) {
    tips.push('No taxon passes this exploratory Z threshold. Lower the threshold to inspect the ranking; this does not change the original pipeline result.');
  }
  if (!stage.evidence_available || !stage.genes.length) {
    tips.push('Per-gene matrices were not included in this export. Re-export while the matrices are available before interpreting gene support or deciding on more references.');
    return tips;
  }
  const counts = stage.counts || {};
  if ((counts.reference_taxa || 0) < 3) {
    tips.push('Fewer than three reference taxa were represented. Broaden this reference panel and rerun the tree analysis before making a narrow assignment.');
  }
  const top = stage.predictions[0];
  if (top && Number.isFinite(top.locus_votes) && top.locus_votes > 0 && top.locus_votes < 3) {
    tips.push('The top taxon has fewer than three supporting loci. Inspect read recovery and consider adding related references before a rerun.');
  }
  const outside = stage.predictions.filter(row => !selected.includes(row) && (row.locus_votes || 0) >= 2)
    .sort((a, b) => b.locus_votes - a.locus_votes).slice(0, 3);
  if (outside.length) {
    tips.push(`Gene votes also support ${outside.map(row => row.taxon).join(', ')} outside the current Z selection. Consider adding close relatives to the next reference panel and rerunning; these are not confirmed components.`);
  }
  if (stage.predictions.length > 1 && top?.score != null && stage.predictions[1]?.score != null &&
      top.score > 0 && stage.predictions[1].score / top.score > 0.8) {
    tips.push('The top two aggregate scores are close. Compare their genes and reference coverage; a broader or better-balanced panel may help separate them.');
  }
  if (!tips.length) {
    tips.push('No obvious reference-coverage warning was detected by these simple checks. Review individual genes and QC before interpreting the result.');
  }
  return tips;
}

export async function readReportFile(file) {
  if (!file || file.size > MAX_FILE_BYTES) {
    throw new Error('Choose a report smaller than 10 MB. Do not select reads, alignments, or matrix folders.');
  }
  if (!/\.pea\.json(\.gz)?$/i.test(file.name)) {
    throw new Error('Choose a .pea.json or .pea.json.gz report.');
  }
  let stream = file.stream();
  if (file.name.endsWith('.gz')) {
    if (!globalThis.DecompressionStream) {
      throw new Error('This browser cannot read gzip. Export the uncompressed .pea.json file.');
    }
    stream = stream.pipeThrough(new DecompressionStream('gzip'));
  }
  const reader = stream.getReader();
  const parts = [];
  let total = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_JSON_BYTES) throw new Error('Expanded report exceeds the 20 MB limit.');
      parts.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) { bytes.set(part, offset); offset += part.byteLength; }
  let parsed;
  try { parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
  catch { throw new Error('The report is not valid UTF-8 JSON.'); }
  return validateReport(parsed);
}
