# Portable report format (v1)

SPrOUT and MrKnowItAll export the same compact JSON object:

```json
{
  "schema_version": "sprout-pea/v1",
  "sample_id": "my_sample",
  "generated_at": "2026-10-13T00:00:00+00:00",
  "producer": "SPrOUT / MrKnowItAll",
  "stages": [
    {
      "id": "order",
      "level": "order",
      "default_z": 0.9,
      "predictions": [
        {
          "taxon": "Rosales",
          "rank": 1,
          "score": 102.47,
          "z_score": 7.32,
          "pipeline_selected": true,
          "selected_by": ["aggregate_z", "locus_votes"],
          "locus_votes": 23,
          "query_votes": 32,
          "median_winning_distance": 0.01
        }
      ],
      "genes": [
        {
          "gene": "4691",
          "trees": 2,
          "query_exons": 3,
          "matches": [
            {
              "taxon": "Rosales",
              "query_votes": 2,
              "median_distance": 0.02,
              "example_reference": "Rosales_Rosaceae_Rosa_canina"
            }
          ]
        }
      ],
      "counts": {
        "matrices": 50,
        "query_exons": 80,
        "reference_taxa": 59,
        "requested_genes": 50
      },
      "evidence_available": true,
      "note": "Per-gene nearest-reference evidence is available."
    }
  ]
}
```

`predictions` is the unfiltered complete ranking for a stage; the viewer applies its Z slider
without modifying these values. `pipeline_selected` is the actual historical workflow choice.
`genes[].matches` records nearest-reference votes. A tie may vote for more than one taxon.
`score` and `z_score` may be `null` when undefined. `genes` is empty and
`evidence_available` is false if the matrices were not supplied.
For plain SPrOUT runs, `locus_votes` and `query_votes` are summarized from the per-gene
nearest-reference matches. MrKnowItAll supplies its own candidate evidence when available.

New reports may also include `genes[].exons[]`, `weighted_support`, `tree_note`, and
`summary_tree`. Each exon has an ID, alignment length, median reference usable bp, query usable
bp, a list of `{taxon, score}` contributions, original/displayed tip counts, and a **pruned** tree.
`summary_tree` is a pruned Kew species-tree context using one representative specimen per ranked
taxon. It is not a mix-derived consensus or a claim that every family/genus is monophyletic.
The default export includes workflow-selected taxa plus the top 40 ranked taxa and nearby
branches, with at most 80 displayed tips per tree (`--max-tree-tips` can set 2–200).
Both trees use nested nodes: `l` is branch length, `c` children, and terminal nodes have `n`
(original reference label), `t` (taxon at this stage), and `q` (query-tip flag).

For each query exon and its closest taxon, length-aware contribution is
`min(1, usable_query_bp / median_usable_reference_bp) × 1/(1 + tree_distance)`, divided equally
among tied taxa. Contributions sum across query exons. This is an exploratory support measure,
not SPrOUT's ranking score, mixture abundance, statistical support, or a posterior probability.
If the trimmed alignment or distance matrix is missing, the contribution is unavailable rather
than inferred from a guess. Adjusting Z changes highlights, not tree topology or contribution.

The `.gz` form is simply UTF-8 JSON compressed with gzip. No raw reads, sequences, full trees,
alignments, or complete distance matrices belong in this schema. The exporter limits uncompressed
reports to 20 MB; the web app limits the selected file to 10 MB and expanded JSON to 20 MB.
