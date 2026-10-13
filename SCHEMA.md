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
`genes[].matches` records nearest-reference votes only. A tie may vote for more than one taxon.
`score` and `z_score` may be `null` when undefined. `genes` is empty and
`evidence_available` is false if the matrices were not supplied.

The `.gz` form is simply UTF-8 JSON compressed with gzip. No raw reads, sequences, alignments,
trees, or complete distance matrices belong in this schema. The exporter limits uncompressed
reports to 20 MB; the web app limits the selected file to 10 MB and expanded JSON to 20 MB.
