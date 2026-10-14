# SPrOUT-PEA

SPrOUT-PEA (Prediction Exploration App) is a small, browser-based result viewer for
[SPrOUT](https://github.com/nhu92/SPrOUT) and its reference-building extension
[MrKnowItAll](https://github.com/nhu92/MrKnowItAll).

Open the [online app](https://nhu92.github.io/SPrOUT-PEA/) or serve this repository locally:

```bash
python -m http.server 8000
```

Then open <http://localhost:8000>. No account or server upload is needed: the report stays in
your browser. Use **Open report** to select a `.pea.json` or `.pea.json.gz` file (10 MB maximum).
For a folder you can open directly from OneDrive without a local server, run
`npm run build:offline` and copy `dist/index.html`. That standalone file includes the synthetic
demo and works when double-clicked; real reports are still selected with **Open report**.
Do **not** upload FASTQ files, full alignments, or SPrOUT's matrix directory. The exporter keeps
the report small and leaves those files on the analysis computer.

## What you can see

- Order, family, and genus rankings in one place, with score and Z value charts.
- A Z threshold you can change for each stage and a downloadable candidate list.
- The original pipeline-selected taxa, including MrKnowItAll taxa rescued by gene votes.
- Per-gene nearest-reference evidence, query-exon votes, and reference names.
- A navigable tree for each exported exon, with branches leading to the current Z-selected taxa highlighted.
- An overall pruned Kew reference tree with candidate scores and nearby context branches.
- Exploratory exon contribution scores adjusted for usable A/C/G/T length and tree distance.
- Cautious suggestions about when broader references or a rerun may help.

Changing Z in the app **does not rerun SPrOUT or add new references**. Tree distances and scores
are evidence for taxon placement, not estimates of mixture weight or proof of a species.
The green tree branches update with the current Z cutoff. The overall tree is a **reference
topology with one representative specimen per taxon**, not a consensus inferred from the mix.
Exon trees are pruned to keep the portable report small; each view states how many original tips
were retained. By default, the exporter keeps the workflow-selected taxa, up to 40 top-ranked
taxa, and nearby branches, capped at 80 displayed tips per tree. A very low Z threshold can
select taxa outside this portable view; the app warns about that. Older reports without tree
data still open, but cannot display these new views.

## Create a report

The SPrOUT repository includes `export_pea.py`. Its example `sample_command.sh` now creates a
combined `01x02x03.pea.json.gz` and a readable `01x02x03.report.md` automatically. For an
existing stage with retained matrices:

```bash
python /path/to/SPrOUT/export_pea.py stage \
  --project my_sample --level order \
  --predictions my_sample.predictions.csv \
  --candidates my_sample.order_candidates.txt \
  --matrix-dir my_sample_matrix --phylo-dir my_sample_phylo \
  --context-tree /path/to/kew/treeoflife.current.tree \
  --gene-list gene.list.txt --z-threshold 0.9 \
  --output my_sample.order.pea.json --markdown my_sample.order.report.md
```

Run `export_pea.py merge --project my_sample --input order.pea.json family.pea.json \
--output my_sample.pea.json.gz --markdown my_sample.report.md` to combine stages. If old matrices
are gone, omit `--matrix-dir`; the viewer will show the ranking but clearly mark per-gene
evidence as unavailable. New MrKnowItAll HPC stages write compact reports before deleting their
temporary matrices and combine them at the end of a sample run.
The phylogeny directory must still contain `*.tre` and `*_trimmed.fasta` when `stage` runs.
`--context-tree` is optional for plain SPrOUT; MrKnowItAll supplies its cached Kew tree.

## Development and tests

The app has no runtime dependencies. It is a static HTML/CSS/JavaScript website. With Node.js
18 or later, run:

```bash
node --test tests/*.test.mjs
```

`examples/demo.pea.json` is synthetic and is only a UI demonstration. The report schema is
described in [SCHEMA.md](SCHEMA.md). GitHub Pages publishes the main branch automatically.

## Limits

This is a research viewer, not a diagnostic tool. Kew and curated reference coverage, gene
recovery, and read quality limit the conclusions. A weak match or a close runner-up is a prompt
to inspect evidence, not a definitive identification.
