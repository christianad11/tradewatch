# TradeWatch-LB

An auditable Lebanon mirror-trade anomaly MVP. It ranks statistical discrepancies for investigation and never treats them as proof of wrongdoing.

## Reproduce

From this folder:

```bash
make data
make test
make web
```

The first data run queries the official UN Comtrade public preview API and caches every raw response. Later runs use the cache.

## Outputs

- `artifacts/dashboard.json`: frontend data contract and headline outputs.
- `artifacts/mirror_pairs.parquet`: canonical scored mirror table.
- `data/metadata/comtrade_snapshot.json`: extraction provenance and cache hash.
- `VALIDATED_PLAN.md`: scope validation and PRD deviations.

## Submission package

- `submission/TradeWatch-LB_Final_Report.pdf` and `.docx`: final report.
- `submission/screenshots/dashboard-home.png`: dashboard overview.
- `submission/screenshots/top-case-evidence.png`: strongest ranked evidence file.
- `submission/screenshots/ai-validation.png`: AI-method and evaluation explainer.
- `submission/screenshots/demo-real-case.png`: final-demo frame showing the real Lebanon case.

Frozen MVP results: 4,931 comparable flows, $13.1B in paired value, and 62 high-priority statistical leads. In the controlled benchmark, all 80 severe one-sided 5× value injections were recovered within the top 1% of records (also 100% in the top 5%).

The narrated demo video, its voiceover, and its narration script are intentionally excluded from this repository.

## Interpretation

Mirror discrepancies may result from CIF/FOB valuation, timing, re-exports, transit, partner attribution, classification, estimation, or revisions. An investigation-priority score is not a fraud probability.
