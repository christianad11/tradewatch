# TradeWatch-LB validated MVP plan

## Verdict

Proceed. The core research question is feasible within a short capstone window, but the full 2015–2025/HS4 scope should be treated as a post-MVP expansion.

## Validated assumptions

- Lebanon remains UN M49 code `422`.
- The current UN Comtrade site advertises up to 100,000 records per call and 500 calls per day with a free API key.
- The unauthenticated preview endpoint is live but capped at 500 records per call.
- Lebanon has 2024 annual import data in the current API; the live feasibility response reported about $17.3B in total imports.
- The preview endpoint returns Lebanon in HS 2017 (`H5`) but 2022–2024 partners in HS 2022 (`H6`). Because the PRD forbids mixing revisions, the keyless MVP uses 2019–2021, when both sides are reported in HS 2017.

## MVP scope actually executed

- 2019–2021 annual data.
- Top six Lebanese import partners per year.
- HS4 bilateral mirror pairs, both reporting directions.
- Tier A/B/C comparability labels.
- Transparent mirror-gap, temporal, unit-value, and materiality features.
- Robust baseline, Isolation Forest, Local Outlier Factor, and a 0–100 Investigation Priority Score.
- Synthetic 5× perturbation sensitivity check.
- Interactive command center, explorer, case evidence view, model validation, and caveats.

## Changes from the PRD

- Reduced the first run from 2015–2025 to 2019–2021 and top partners to fit the preview API, preserve one HS revision, and meet the deadline.
- Omitted the optional graph network and autoencoder.
- Used a local artifact-driven frontend rather than a separate FastAPI service; the Python artifact contract remains ready for an API later.

## Go/no-go gate

The build passes if it produces at least 1,000 exact year/partner/HS4 mirror pairs, finite scores within 0–100, and synthetic severe anomalies that rank materially above normal observations.
