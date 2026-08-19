# TradeWatch-LB — Product Requirements Document
## AI Forensic Anomaly Detection for Lebanon’s International Trade

**Version:** 1.0  
**Target:** LebNet AI Fellowship capstone / research prototype  
**Deadline:** 20 August 2026  
**Primary implementation agent:** Codex  
**Project type:** Applied ML + anomaly detection + international trade analytics  
**Legal/interpretive status:** Research and risk-prioritization tool. An anomaly is not evidence of fraud.

---

# 0. Codex Operating Instruction

Treat this PRD as the source of truth.

The purpose of TradeWatch-LB is **not** to accuse companies, countries, customs officers, or importers of fraud. It is to build a reproducible anomaly-detection system over official bilateral trade statistics and identify flows that warrant further investigation.

The critical interpretive rule is:

> **Mirror-trade discrepancies are risk signals, not proof of misinvoicing, tax evasion, smuggling, corruption, or fraud.**

Possible legitimate causes include:

- CIF vs FOB valuation differences;
- freight/insurance;
- time lags;
- re-exports;
- transit through third countries;
- partner-country attribution;
- quantity/unit differences;
- classification differences;
- statistical revisions;
- confidentiality;
- missing reporting;
- exchange-rate effects.

The system must explain these caveats prominently.

Prefer a smaller, auditable, reproducible anomaly engine over an opaque “AI fraud detector.”

---

# 1. Project Summary

## 1.1 One-sentence pitch

**TradeWatch-LB uses machine learning to scan Lebanon’s international trade flows, compare Lebanese import records with partner-country export records, and rank statistically unusual discrepancies for investigation.**

## 1.2 Research question

> **Can unsupervised machine learning detect unusual bilateral trade-flow patterns involving Lebanon that would be difficult to identify from raw UN Comtrade tables alone?**

## 1.3 Public-facing question

> **Where do Lebanon’s import records diverge unusually from what trading partners report exporting to Lebanon?**

## 1.4 Why it matters

International trade datasets contain millions of records across:

- years;
- countries;
- commodities;
- quantities;
- values;
- trade flows.

A human analyst can investigate one product or partner at a time. An ML system can establish normal patterns and rank the most unusual combinations across the full dataset.

The project is valuable if it produces:

- transparent anomaly scores;
- clear evidence trails;
- useful explanations;
- reproducible data;
- defensible non-accusatory findings.

---

# 2. Success Definition

The MVP succeeds if it produces:

1. a reproducible Lebanon trade dataset from official UN Comtrade data;
2. bilateral mirror-flow pairs;
3. transparent engineered risk/anomaly features;
4. at least two anomaly-detection approaches;
5. synthetic anomaly testing to verify model sensitivity;
6. time-series anomaly detection;
7. ranked real-world Lebanon trade anomalies;
8. an interactive dashboard;
9. an evidence page for every flag;
10. strong caveats preventing “AI found fraud” interpretation.

The ideal final statement is:

> “TradeWatch-LB analyzed X bilateral commodity-year flows and identified Y high-priority statistical anomalies. These are investigation leads, not findings of wrongdoing.”

---

# 3. Primary Data Source

## 3.1 UN Comtrade

Official database:

https://comtrade.un.org/

UN Comtrade provides annual and monthly trade statistics by:

- reporter;
- partner;
- commodity;
- trade flow;
- year/month;
- value;
- quantity;
- weight;
- classification.

Current Comtrade Plus offers free registration/API access. The current public site states that a free API key can provide up to 100,000 records per call and up to 500 API calls per day; Codex must confirm current limits in the official documentation before relying on them.

Methodology guide:

https://comtradeapi.un.org/files/v1/app/wiki/MethodologyGuideforComtradePlus.pdf

### Lebanon reporter code

UN M49 country code for Lebanon:

`422`

Codex should verify using current official UN M49 metadata instead of hard-coding blindly.

---

# 4. Core Dataset Design

## 4.1 Primary analysis granularity

Use annual merchandise trade.

MVP window:

**2015–2025**, subject to actual data availability.

Do not assume 2025 is complete.

Run a data-availability audit before analysis.

Primary commodity level:

**HS4** for robustness and manageable scale.

Stretch:

**HS6** for finer anomaly investigation.

Why start HS4:

- fewer sparse flows;
- fewer classification inconsistencies;
- easier mirror matching;
- faster API retrieval;
- more stable unit-value features.

---

## 4.2 Mirror pair definition

For a Lebanese import record:

> Lebanon reports importing commodity `h` from country `p` in year `t`.

Mirror it against:

> Partner country `p` reports exporting commodity `h` to Lebanon in year `t`.

Variables:

- `L_import_value`
- `P_export_value`
- `L_quantity`
- `P_quantity`
- `L_net_weight`
- `P_net_weight`

Core pair key:

`(year, HS_code, partner_country)`

---

# 5. Data Acquisition

## 5.1 Required data

For each year/partner/commodity:

### Side A

Reporter = Lebanon  
Flow = Imports  
Partner = partner country

### Side B

Reporter = partner country  
Flow = Exports  
Partner = Lebanon

Use the same:

- frequency;
- HS revision/classification;
- commodity aggregation;
- year.

Do not pair records across incompatible HS revisions without a concordance table.

---

## 5.2 Download strategy

Implement an API client with:

- `.env` API key;
- retry/backoff;
- caching;
- request logging;
- raw JSON/CSV/Parquet storage;
- rate-limit handling;
- data-availability checks.

Save all raw API responses or normalized raw tables.

Suggested layout:

```text
data/raw/comtrade/
  2015/
  2016/
  ...
```

Create:

`data/metadata/comtrade_snapshot.json`

containing:

- extraction timestamp;
- API endpoint version;
- requested years;
- years actually available;
- HS classification;
- query counts;
- API errors;
- row counts;
- SHA-256 hashes.

---

# 6. Data Quality and Exclusions

Before anomaly detection, classify records into:

### Tier A — strong mirror comparability

- both sides reported;
- same commodity level;
- same year;
- positive trade values;
- no obvious missing/invalid quantity fields where quantity features are used.

### Tier B — value-comparable only

- both sides reported trade value;
- quantity/weight missing or incompatible.

### Tier C — missing mirror

- one side absent.

Tier C can be analyzed separately as a **reporting-gap signal**, but must not be treated as a value discrepancy.

---

## 6.1 Exclude/flag

- zero or negative trade values where invalid;
- “World” partner aggregates;
- unspecified partner categories for primary bilateral analysis;
- obvious duplicate records;
- inconsistent HS revisions;
- aggregate records mixed with detailed records;
- suppressed/confidential values where comparison is impossible;
- records with estimation flags if the chosen metric requires reported quantities.

Do not delete estimated records silently. Keep flags.

---

# 7. Feature Engineering

Every mirror pair should produce interpretable features.

## 7.1 Value mirror features

### Absolute gap

`abs_gap = P_export_value - L_import_value`

### Absolute gap magnitude

`abs_gap_usd = abs(P_export_value - L_import_value)`

### Symmetric relative gap

Prefer a symmetric metric:

`mirror_gap_ratio = abs(P_export_value - L_import_value) / ((P_export_value + L_import_value)/2 + eps)`

This avoids division by one extremely small side.

### Signed log ratio

`log_ratio = log((L_import_value + eps) / (P_export_value + eps))`

Interpretation:

- > 0: Lebanon-reported import value higher;
- < 0: partner-reported export value higher.

---

## 7.2 Unit-value features

When quantity/weight units are comparable:

`Lebanon_unit_value = L_trade_value / L_quantity`

`Partner_unit_value = P_trade_value / P_quantity`

Then:

- unit-value log ratio;
- deviation from commodity-year median;
- deviation from partner-product historical median;
- robust z-score.

Never compare unit values across incompatible quantity units.

---

## 7.3 Temporal features

For each partner × HS code:

- year-over-year value growth;
- rolling median;
- rolling MAD;
- sudden gap change;
- deviation from 3-year/5-year historical baseline;
- first-time appearance;
- disappearance after persistent trade;
- persistence of anomaly.

Example:

`gap_change_z`

---

## 7.4 Peer features

Compare one Lebanon flow against:

### Product peers

How unusual is the mirror discrepancy for the same HS code among comparable reporter countries?

### Partner peers

How unusual is this partner’s discrepancy across products?

### Lebanon history

How unusual is the current pair compared with its own history?

These peer features are essential because normal mirror gaps vary by product and trade route.

---

## 7.5 Scale features

Include:

- log trade value;
- share of Lebanon’s imports for that product;
- partner share;
- commodity import concentration.

A $10M gap on a $1B flow is different from a $10M gap on a $12M flow.

---

# 8. Avoiding False “Fraud” Signals

Codex must implement an explanation layer that surfaces likely non-fraud reasons.

Each flagged row should include fields such as:

- `possible_cif_fob_effect`
- `possible_time_lag`
- `possible_reexport`
- `quantity_incomparable`
- `estimated_record`
- `mirror_missing`
- `large_value_low_relative_gap`
- `small_value_high_relative_gap`

Do not label these as confirmed explanations; they are caveat indicators.

---

# 9. ML / Anomaly Models

## 9.1 Baseline — rule-based robust z-score

For each relevant peer group:

- median;
- MAD;
- robust z-score.

Use this as the transparent baseline.

Example:

`robust_z = 0.6745 * (x - median) / MAD`

Applied to:

- signed log mirror ratio;
- unit-value log ratio;
- YoY change.

---

## 9.2 Model 1 — Isolation Forest

Primary unsupervised model.

Inputs should be standardized/appropriately transformed features such as:

- absolute/symmetric mirror gap;
- log ratio;
- log trade value;
- unit-value deviation;
- temporal deviation;
- peer deviation;
- missingness indicators.

Do not include IDs such as country names as numeric ordinals.

Train on Tier A/B flows with proper feature handling.

Output:

`iforest_score`

---

## 9.3 Model 2 — Local Outlier Factor or One-Class SVM

Preferred second model:

**Local Outlier Factor** for local neighborhood anomalies.

Use for offline scoring.

Alternative:

One-Class SVM only if runtime/data scale permits.

---

## 9.4 Optional autoencoder

Only after robust baselines work.

Architecture:

- normalized numeric feature vector;
- 2–3 hidden layers;
- bottleneck;
- reconstruction error as anomaly score.

Compare whether it identifies qualitatively different anomalies.

Do not add deep learning only for optics.

---

## 9.5 Ensemble anomaly score

Construct an explainable composite score.

Example components:

- robust mirror-gap percentile;
- Isolation Forest percentile;
- LOF percentile;
- unit-value anomaly percentile;
- temporal anomaly percentile;
- economic materiality percentile.

Possible formula:

```text
composite =
  0.30 * mirror_model_percentile
+ 0.20 * temporal_percentile
+ 0.15 * unit_value_percentile
+ 0.20 * model_ensemble_percentile
+ 0.15 * materiality_percentile
```

Weights must be configurable and justified.

Do **not** call this “fraud probability.”

Name it:

**Investigation Priority Score**

0–100.

---

# 10. Validation Without Fraud Labels

There is no reliable ground-truth “fraud” label in UN Comtrade. Therefore validation must be honest.

## 10.1 Synthetic anomaly injection

Create a clean-ish subset of historically stable flows.

Inject known anomalies:

### Type A — value spike

Multiply one reporter’s value by:

- 1.5×;
- 2×;
- 5×;
- 10×.

### Type B — unit-price anomaly

Multiply value while holding quantity constant.

### Type C — quantity anomaly

Alter quantity while holding value approximately constant.

### Type D — temporal jump

Inject a sudden one-year deviation.

### Type E — missing mirror

Remove one side.

Then test:

- recall@top-k;
- precision@top-k on synthetic events;
- mean percentile rank of injected anomalies;
- detection sensitivity by anomaly severity.

---

## 10.2 Backtesting stability

Train/fit models on earlier years, score later years.

Example:

- baseline period: 2015–2021;
- score: 2022–2024/2025.

This tests whether the system detects emerging deviations.

Do not call this fraud-validation.

---

## 10.3 Cross-model agreement

For each real anomaly report:

- robust z-score;
- Isolation Forest percentile;
- LOF percentile;
- temporal score.

High-confidence flag:

multiple methods agree.

This is stronger than relying on one opaque model.

---

# 11. Headline Outputs

Generate automatically:

- total trade value analyzed;
- number of mirror pairs;
- number of partners;
- number of HS4 products;
- number of Tier A/B/C records;
- top 20 investigation-priority flows;
- persistent anomalies across ≥2 years;
- largest absolute gaps;
- largest relative gaps;
- strongest unit-value anomalies;
- strongest temporal anomalies.

Never hard-code the results.

---

# 12. Investigation Case File

Every top anomaly gets a generated case page.

Example structure:

# HS 8703 — Motor vehicles
**Partner:** Country X  
**Year:** 2024  
**Investigation Priority:** 96.4 / 100

### Reported trade

Lebanon imports:
`$...`

Partner exports to Lebanon:
`$...`

Absolute difference:
`$...`

Symmetric relative difference:
`...%`

### Historical context

2018: ...  
2019: ...  
...  
2024: ...

### Why flagged

- mirror gap 99th percentile;
- unusual vs own history;
- unit value 4.1 robust SD from peer median;
- Isolation Forest anomaly percentile 98.7.

### Caveats

- partner export values commonly differ from destination import values;
- CIF/FOB may explain part of the gap;
- trade may be routed through a third country;
- customs/statistical revisions may apply.

### Conclusion

> **Statistically unusual flow requiring contextual investigation. This analysis does not establish fraud or wrongdoing.**

---

# 13. Product UX

Name:

# **TradeWatch Lebanon**
### AI Forensic Intelligence for International Trade

---

## 13.1 Screen 1 — Command Center

Hero:

> **Where does Lebanon’s trade data stop looking normal?**

KPIs:

- `$X` trade analyzed;
- `N` bilateral commodity-year mirror pairs;
- `N` high-priority anomalies;
- `N` partners;
- date range.

Charts:

- anomaly count by year;
- top commodity chapters;
- top partner countries;
- anomaly value vs anomaly score.

Use “flagged,” “unusual,” and “investigation priority,” never “fraudulent.”

---

## 13.2 Screen 2 — Anomaly Explorer

Filters:

- year;
- partner;
- HS chapter/product;
- score threshold;
- anomaly type;
- minimum trade value.

Table:

| Score | Year | Partner | HS | Product | Lebanon Imports | Partner Exports | Gap |
|---:|---:|---|---|---|---:|---:|---:|

---

## 13.3 Screen 3 — Case File

Detailed evidence page described in Section 12.

Visuals:

- two-line mirror trade time series;
- signed gap chart;
- unit-value history;
- anomaly score components.

---

## 13.4 Screen 4 — Trade Network

Optional but visually strong.

Nodes:

- Lebanon;
- partner countries;
- commodity groups.

Edges:

- trade value;
- anomaly intensity.

Do not build if it delays core experiment.

---

## 13.5 Screen 5 — Model Lab

Show:

- synthetic anomaly experiment;
- detection curves;
- model comparison;
- feature definitions;
- why no fraud accuracy is reported.

This is crucial for judges.

---

## 13.6 Screen 6 — Methodology & Caveats

Must prominently explain mirror-analysis limitations.

Reference the IMF principle that mirror data can identify inconsistencies for customs/risk analysis but does not itself demonstrate fraud.

---

# 14. Technical Stack

## Data / ML

- Python 3.11+
- Polars preferred for large tables
- Pandas where convenient
- PyArrow
- NumPy
- scikit-learn
- SciPy
- optional PyOD
- optional PyTorch for autoencoder

## API

- FastAPI
- Pydantic

## Frontend

- Next.js
- TypeScript
- Tailwind
- Plotly.js or ECharts/Recharts

## Storage

- Parquet files for analytics
- DuckDB for fast local querying
- optional SQLite for metadata

Preferred:

**Parquet + DuckDB**

This avoids unnecessary infrastructure.

---

# 15. Repository Structure

```text
tradewatch-lb/
├── README.md
├── LICENSE
├── .env.example
├── pyproject.toml
├── Makefile
├── config/
│   ├── project.yaml
│   ├── feature_weights.yaml
│   └── seeds.yaml
├── data/
│   ├── raw/
│   │   └── comtrade/
│   ├── interim/
│   ├── processed/
│   └── metadata/
├── src/
│   ├── data/
│   │   ├── comtrade_client.py
│   │   ├── availability.py
│   │   ├── download.py
│   │   ├── normalize.py
│   │   └── build_mirrors.py
│   ├── features/
│   │   ├── mirror_features.py
│   │   ├── unit_value.py
│   │   ├── temporal.py
│   │   └── peers.py
│   ├── modeling/
│   │   ├── robust_baseline.py
│   │   ├── isolation_forest.py
│   │   ├── lof.py
│   │   ├── ensemble.py
│   │   └── synthetic_validation.py
│   ├── reporting/
│   │   ├── case_files.py
│   │   ├── figures.py
│   │   └── generate_report.py
│   └── api/
│       └── main.py
├── artifacts/
├── reports/
│   ├── cases/
│   ├── figures/
│   └── final_report.md
├── tests/
│   ├── test_mirror_pairing.py
│   ├── test_gap_metrics.py
│   ├── test_unit_compatibility.py
│   ├── test_no_world_partner.py
│   ├── test_synthetic_injection.py
│   └── test_score_bounds.py
└── web/
    └── ...
```

---

# 16. Configuration Contract

Example `config/project.yaml`:

```yaml
project_name: TradeWatch-LB
reporter_m49: 422

frequency: annual
classification: HS
commodity_level: HS4

start_year: 2015
end_year: 2025

minimum_trade_value_usd: 100000

models:
  robust_z: true
  isolation_forest: true
  lof: true
  autoencoder: false

isolation_forest:
  contamination: auto
  random_state: 42

synthetic_validation:
  seed: 42
  multipliers: [1.5, 2, 5, 10]

priority_score:
  mirror: 0.30
  temporal: 0.20
  unit_value: 0.15
  ensemble: 0.20
  materiality: 0.15
```

All major thresholds must be configurable.

---

# 17. Data Schema

Canonical processed mirror table:

```text
year
hs_code
hs_description
partner_code
partner_name

lb_import_value
partner_export_value

lb_quantity
partner_quantity
lb_net_weight
partner_net_weight

lb_qty_unit
partner_qty_unit

lb_estimated
partner_estimated

mirror_tier

abs_gap_usd
symmetric_gap
signed_log_ratio

lb_unit_value
partner_unit_value
unit_value_log_ratio

yoy_gap_change
rolling_gap_median
rolling_gap_mad
temporal_robust_z

peer_product_z
peer_partner_z

log_trade_value
product_import_share
partner_share

robust_score
iforest_score
lof_score
temporal_score
materiality_score

investigation_priority
anomaly_types
caveat_flags
```

---

# 18. API Requirements

### `GET /api/summary`

Returns global dashboard KPIs.

### `GET /api/anomalies`

Query params:

- year
- partner
- hs
- minimum_score
- minimum_value
- anomaly_type

### `GET /api/anomalies/{case_id}`

Returns complete case file.

### `GET /api/timeseries/{partner}/{hs}`

Returns bilateral mirror history.

### `GET /api/model/validation`

Returns synthetic anomaly experiment.

### `GET /api/methodology`

Returns feature/model metadata and disclaimers.

---

# 19. Testing Requirements

## Pairing tests

For a fixture:

Lebanon import from France, HS X, year Y

must match only:

France export to Lebanon, same HS X, same year Y.

Do not accidentally pair:

- Lebanon export;
- France import;
- different year;
- different HS level.

---

## Metric tests

Hand-test:

- absolute gap;
- symmetric gap;
- signed log ratio;
- unit values;
- robust z-score.

---

## Missingness tests

Ensure:

- no divide-by-zero;
- missing quantity does not generate fake zero unit value;
- suppressed data remains missing;
- missing mirror is a category, not zero exports.

---

## Model tests

- deterministic seeds;
- anomaly scores finite;
- priority score ∈ [0,100];
- synthetic severe anomalies rank higher on average than mild injected anomalies.

---

## UI tests

- no “fraud detected” language;
- caveat visible on each case;
- all numbers sourced from artifacts;
- top anomalies reproducible from API.

---

# 20. Build Order

## Phase 1 — Feasibility gate

1. obtain free UN Comtrade API key if required;
2. confirm official API limits;
3. query data availability for Lebanon;
4. retrieve two test years;
5. retrieve both mirror directions;
6. prove one exact partner-HS-year pair matches correctly.

**Go/no-go:** must successfully generate at least 1,000 clean mirror pairs across multiple partners/products before building the UI.

---

## Phase 2 — Full acquisition

1. download selected years;
2. cache raw files;
3. standardize HS revision;
4. create mirror pairs;
5. categorize Tier A/B/C;
6. save Parquet.

---

## Phase 3 — Baseline analysis

Before ML:

- rank largest absolute gaps;
- largest relative gaps;
- persistent gaps;
- missing mirrors.

This is essential to understand the dataset.

---

## Phase 4 — Feature engineering

Build:

- mirror ratios;
- temporal deviations;
- unit values;
- peer deviations;
- materiality.

Validate each statistically and with unit tests.

---

## Phase 5 — Models

1. robust z baseline;
2. Isolation Forest;
3. LOF;
4. normalize scores to percentiles;
5. ensemble.

---

## Phase 6 — Synthetic validation

Inject controlled anomalies.

Produce:

- recall@top1%;
- recall@top5%;
- mean percentile;
- severity curves.

If models cannot detect large synthetic anomalies, fix the features/model before presenting real results.

---

## Phase 7 — Real anomaly analysis

Freeze model configuration.

Score Lebanon data.

Generate top cases.

Do manual sanity review for:

- obvious missing data;
- tiny denominators;
- aggregation issues;
- classification mismatches.

---

## Phase 8 — UI

Build command center + explorer + case file + model lab.

---

# 21. Final Research Report

Generate:

`reports/final_report.md`

Sections:

1. Abstract
2. Motivation
3. Research question
4. UN Comtrade data
5. Mirror methodology
6. Data cleaning
7. Feature engineering
8. Anomaly models
9. Synthetic validation
10. Lebanon results
11. Top statistical anomalies
12. Case studies
13. Limitations
14. Ethical/legal interpretation
15. Reproducibility
16. Conclusion
17. References

Every result must come from generated artifacts.

---

# 22. Final Demo Script

### Opening

> “Lebanon reports what it imports. Its trading partners report what they export to Lebanon. Those two records often differ for legitimate reasons — but across thousands of products, partners and years, some differences are statistically extraordinary.”

### Show data

> “TradeWatch-LB pairs both sides of each bilateral trade flow and learns what normal discrepancies look like.”

### Show AI

- mirror gap;
- historical deviation;
- peer deviation;
- unit-value anomaly;
- Isolation Forest / LOF.

### Open top case

Show both official records side-by-side.

Then historical timeline.

Then:

> “This flow is in the 99.7th percentile of the system’s investigation-priority score.”

### Immediately qualify

> “That does not mean fraud. Mirror statistics are a risk-screening mechanism. Routing, valuation, timing and reporting practices can all create legitimate discrepancies.”

### Finish

> “The contribution is an AI triage system: instead of asking an analyst to inspect tens of thousands of trade flows manually, it tells them where to look first and shows exactly why.”

---

# 23. Claims Policy

## Allowed

- “The model flagged X flows as statistically unusual.”
- “Flow X is in the Yth percentile under the defined anomaly score.”
- “The partner-reported export value differs by X from Lebanon’s reported import value.”
- “The model detected X% of injected severe synthetic anomalies in the top Y% of ranked flows.”
- “This case warrants contextual investigation.”

## Forbidden

- “We found $X of fraud.”
- “Country X stole/evaded $X.”
- “Customs lost $X.”
- “This proves smuggling.”
- “The model detects corruption.”
- “The gap equals tax loss.”
- naming private parties as wrongdoers.

UN Comtrade is country/product-level in this design; do not pretend to identify specific importers.

---

# 24. Scientific/Interpretive Limitations

The final report must explicitly discuss:

1. CIF import valuation commonly exceeds FOB export valuation;
2. time lag between departure and arrival;
3. re-export and transit trade;
4. country-of-origin vs country-of-consignment differences;
5. HS classification mismatch;
6. statistical revisions;
7. estimated quantities;
8. missing/suppressed records;
9. exchange rates;
10. no verified fraud ground truth;
11. unsupervised anomaly detection identifies unusualness, not illegality.

---

# 25. Risk Register

## Risk A — API limits

Mitigation:

- free key;
- cache;
- HS4 MVP;
- chunk by year/partner;
- do not repeatedly download.

## Risk B — incomplete latest year

Mitigation:

- availability audit;
- exclude incomplete year from headline comparisons.

## Risk C — too many false anomalies

Mitigation:

- peer normalization;
- minimum trade value;
- persistence;
- caveat flags;
- multi-model agreement.

## Risk D — quantity units incompatible

Mitigation:

- compare unit values only when unit metadata matches;
- otherwise value-only Tier B.

## Risk E — judge asks “where are fraud labels?”

Answer:

> “There are none, which is why this is explicitly anomaly triage rather than supervised fraud classification. We validate the detector with synthetic perturbations and model agreement, then present real flags as investigation priorities.”

---

# 26. Fallback Scope

If HS4 full history is too heavy:

Use:

- 2019–2025;
- top 25 Lebanon trading partners;
- top 50 HS4 products by import value.

This still yields a meaningful matrix of:

`years × partners × products`

and can support a strong anomaly detector.

If API acquisition is unstable, manually export official UN Comtrade files and run the same pipeline. Record provenance.

---

# 27. Stretch Goals

Only after MVP:

- HS6 drill-down;
- monthly data;
- graph anomaly detection;
- import-price benchmarking against global peers;
- customs-risk scoring by commodity;
- persistent route-shift detection;
- sanctions/re-export context from public sources;
- automated research memo generation with cited evidence;
- multi-country deployment.

---

# 28. Completion Checklist

- [ ] Official UN Comtrade API access working
- [ ] Lebanon data availability audit saved
- [ ] Raw data cached and hashed
- [ ] HS revision fixed/normalized
- [ ] Mirror pairing unit-tested
- [ ] Tier A/B/C records generated
- [ ] Value-gap features generated
- [ ] Unit-value features only for compatible units
- [ ] Temporal features generated
- [ ] Peer features generated
- [ ] Robust baseline generated
- [ ] Isolation Forest trained/scored
- [ ] LOF trained/scored
- [ ] Synthetic anomaly validation completed
- [ ] Priority score frozen
- [ ] Real Lebanon anomalies generated
- [ ] Top cases manually sanity-checked
- [ ] Dashboard complete
- [ ] Case file disclaimers visible
- [ ] Final report generated
- [ ] No fraud accusations anywhere
- [ ] README includes one-command reproduction

---

# 29. Source References

1. United Nations Comtrade Database.  
   https://comtrade.un.org/

2. UN Comtrade Plus Methodology Guide.  
   https://comtradeapi.un.org/files/v1/app/wiki/MethodologyGuideforComtradePlus.pdf

3. United Nations Statistics Division M49 country/area codes.  
   https://unstats.un.org/unsd/methodology/m49/

4. IMF — **The Use of Mirror Data by Customs Administrations in Risk Analysis and Customs Control.** The IMF explicitly describes mirror data as a way to identify inconsistencies that can trigger customs action, not as proof of fraud.  
   https://www.elibrary.imf.org/view/journals/005/2023/005/article-A001-en.xml

5. UN Comtrade methodological trade-data processing documentation.  
   https://comtradeapi.un.org/files/v1/app/wiki/UNSD_Method_trade_data_processing_v6-17_Jun_2019.pdf

---

# 30. Final Product Definition

At submission, TradeWatch-LB should be describable truthfully as:

> **An AI-assisted trade-risk research platform that pairs Lebanon’s reported imports with partner-country exports, models normal discrepancies across products and time, and ranks statistically unusual flows for human investigation without treating anomalies as evidence of fraud.**

That is the product. Do not dilute it into a generic trade dashboard.
