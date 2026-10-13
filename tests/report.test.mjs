import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { recommendations, selectedTaxa, originalTaxa, validateReport, readReportFile } from '../report.js';

const demo = validateReport(JSON.parse(await readFile(new URL('../examples/demo.pea.json', import.meta.url))));

test('valid portable report has order, family and genus', () => {
  assert.deepEqual(demo.stages.map(stage => stage.id), ['order', 'family', 'genus']);
});

test('Z exploration differs from the original pipeline selection', () => {
  const order = demo.stages[0];
  assert.deepEqual(selectedTaxa(order, 0.9).map(row => row.taxon), ['Rosales']);
  assert.deepEqual(originalTaxa(order).map(row => row.taxon), ['Rosales', 'Brassicales']);
  assert.deepEqual(selectedTaxa(order, -1).map(row => row.taxon), ['Rosales', 'Brassicales', 'Fabales']);
});

test('candidate advice notes lower-Z gene votes', () => {
  assert.match(recommendations(demo.stages[0], 0.9).join(' '), /Brassicales/);
});

test('rejects invalid schema and oversized input', async () => {
  assert.throws(() => validateReport({ ...demo, schema_version: 'other' }), /supported/);
  await assert.rejects(readReportFile({ size: 11 * 1024 * 1024 }), /smaller than 10 MB/);
});
