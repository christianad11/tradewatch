from __future__ import annotations

import hashlib
import json
import math
import os
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from urllib.error import HTTPError
from pathlib import Path

import numpy as np
import pandas as pd
import yaml
from sklearn.ensemble import IsolationForest
from sklearn.neighbors import LocalOutlierFactor


ROOT = Path(__file__).resolve().parents[1]
CONFIG = yaml.safe_load((ROOT / "config/project.yaml").read_text())
CACHE = ROOT / "data/raw/comtrade"
ARTIFACTS = ROOT / "artifacts"
BASE = "https://comtradeapi.un.org/public/v1/preview/C/A/HS"
REPORTERS_URL = "https://comtradeapi.un.org/files/v1/app/reference/Reporters.json"
COMMODITIES_URL = "https://comtradeapi.un.org/files/v1/app/reference/H5.json"


def fetch_json(url: str, cache_path: Path) -> dict:
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    if cache_path.exists():
        return json.loads(cache_path.read_text())
    request = urllib.request.Request(url, headers={"User-Agent": "TradeWatch-LB research prototype"})
    for attempt in range(6):
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                payload = json.loads(response.read())
            cache_path.write_text(json.dumps(payload, indent=2))
            time.sleep(0.12)
            return payload
        except HTTPError as error:
            if attempt == 5:
                raise
            retry_after = int(error.headers.get("Retry-After", "0") or 0)
            time.sleep(max(retry_after, 12 * (attempt + 1)) if error.code == 429 else 2**attempt)
        except Exception:
            if attempt == 5:
                raise
            time.sleep(2**attempt)
    raise RuntimeError("unreachable")


def api_query(cache_name: str, **params: object) -> list[dict]:
    defaults = {"maxRecords": 500, "partner2Code": 0, "customsCode": "C00", "motCode": 0}
    query = urllib.parse.urlencode({**defaults, **params})
    url = BASE + "?" + query
    payload = fetch_json(url, CACHE / f"{cache_name}.json")
    if payload.get("error"):
        raise RuntimeError(f"Comtrade error for {cache_name}: {payload['error']}")
    return payload.get("data", [])


def reference_maps() -> tuple[dict[int, str], dict[str, str]]:
    reporters = fetch_json(REPORTERS_URL, ROOT / "data/metadata/reporters.json")
    commodities = fetch_json(COMMODITIES_URL, ROOT / "data/metadata/h5.json")
    countries = {
        int(row.get("reporterCode", row.get("id"))): row.get("reporterDesc", row.get("text", "Unknown"))
        for row in reporters.get("results", [])
        if str(row.get("reporterCode", row.get("id", ""))).isdigit()
    }
    products = {
        str(row.get("id")): str(row.get("text", "Unknown product")).split(" - ", 1)[-1]
        for row in commodities.get("results", [])
        if len(str(row.get("id", ""))) == 4
    }
    return countries, products


def aggregate(rows: list[dict], value_name: str, prefix: str) -> pd.DataFrame:
    normalized = []
    for row in rows:
        hs = str(row.get("cmdCode", ""))
        value = row.get("primaryValue")
        if (
            len(hs) != 4
            or row.get("classificationCode") != CONFIG["classification"]
            or not value
            or float(value) <= 0
        ):
            continue
        normalized.append(
            {
                "year": int(row["refYear"]),
                "partner_code": int(row["partnerCode"] if prefix == "lb" else row["reporterCode"]),
                "hs_code": hs,
                value_name: float(value),
                f"{prefix}_qty": float(row.get("qty") or 0) or np.nan,
                f"{prefix}_qty_unit": int(row.get("qtyUnitCode") or -1),
                f"{prefix}_net_weight": float(row.get("netWgt") or 0) or np.nan,
                f"{prefix}_estimated": bool(row.get("isQtyEstimated") or row.get("legacyEstimationFlag")),
            }
        )
    if not normalized:
        return pd.DataFrame(
            columns=[
                "year", "partner_code", "hs_code", value_name, f"{prefix}_qty", f"{prefix}_net_weight",
                f"{prefix}_qty_unit", f"{prefix}_estimated",
            ]
        )
    frame = pd.DataFrame(normalized)
    numeric = [value_name, f"{prefix}_qty", f"{prefix}_net_weight"]
    result = frame.groupby(["year", "partner_code", "hs_code"], as_index=False)[numeric].sum(min_count=1)
    meta = frame.groupby(["year", "partner_code", "hs_code"], as_index=False).agg(
        **{f"{prefix}_qty_unit": (f"{prefix}_qty_unit", "first"), f"{prefix}_estimated": (f"{prefix}_estimated", "max")}
    )
    return result.merge(meta, on=["year", "partner_code", "hs_code"])


def robust_abs_z(values: pd.Series) -> pd.Series:
    median = values.median()
    mad = (values - median).abs().median()
    if not mad or math.isnan(mad):
        return pd.Series(np.zeros(len(values)), index=values.index)
    return (0.6745 * (values - median) / mad).abs().clip(upper=25)


def percentile(values: pd.Series) -> pd.Series:
    return values.rank(method="average", pct=True).fillna(0) * 100


def acquire() -> tuple[pd.DataFrame, dict[int, str], dict[str, str], list[int]]:
    countries, products = reference_maps()
    chosen: set[int] = set()
    partner_years: list[tuple[int, int]] = []
    for year in CONFIG["years"]:
        totals = api_query(
            f"{year}_lb_import_totals", period=year, reporterCode=422, flowCode="M", cmdCode="TOTAL"
        )
        partners = sorted(
            (
                (int(row.get("partnerCode", 0)), float(row.get("primaryValue") or 0))
                for row in totals
                if int(row.get("partnerCode", 0)) not in {0, 472, 490, 568}
            ),
            key=lambda item: item[1],
            reverse=True,
        )[: CONFIG["top_partners"]]
        for partner, _ in partners:
            chosen.add(partner)
            partner_years.append((year, partner))

    def load_pair(item: tuple[int, int]) -> tuple[pd.DataFrame, pd.DataFrame]:
        year, partner = item
        imports = api_query(
            f"{year}_lb_imports_{partner}", period=year, reporterCode=422, partnerCode=partner,
            flowCode="M", cmdCode="AG4",
        )
        exports = api_query(
            f"{year}_{partner}_exports_lb", period=year, reporterCode=partner, partnerCode=422,
            flowCode="X", cmdCode="AG4",
        )
        return aggregate(imports, "lb_import_value", "lb"), aggregate(exports, "partner_export_value", "partner")

    with ThreadPoolExecutor(max_workers=2) as pool:
        loaded = list(pool.map(load_pair, partner_years))
    all_imports = [item[0] for item in loaded]
    all_exports = [item[1] for item in loaded]
    left = pd.concat(all_imports, ignore_index=True)
    right = pd.concat(all_exports, ignore_index=True)
    pairs = left.merge(right, on=["year", "partner_code", "hs_code"], how="outer")
    pairs["partner_name"] = pairs.partner_code.map(countries).fillna("Partner code " + pairs.partner_code.astype(str))
    pairs["hs_description"] = pairs.hs_code.map(products).fillna("HS " + pairs.hs_code)
    return pairs, countries, products, sorted(chosen)


def engineer(pairs: pd.DataFrame) -> pd.DataFrame:
    df = pairs.copy()
    both = df.lb_import_value.notna() & df.partner_export_value.notna()
    qty_ok = (
        both
        & df.lb_qty.notna()
        & df.partner_qty.notna()
        & (df.lb_qty > 0)
        & (df.partner_qty > 0)
        & (df.lb_qty_unit == df.partner_qty_unit)
    )
    df["mirror_tier"] = np.select([qty_ok, both], ["A", "B"], default="C")
    df["abs_gap_usd"] = (df.partner_export_value - df.lb_import_value).abs()
    denominator = (df.partner_export_value + df.lb_import_value) / 2
    df["symmetric_gap"] = (df.abs_gap_usd / denominator.replace(0, np.nan)).clip(upper=2)
    df["signed_log_ratio"] = np.log((df.lb_import_value + 1) / (df.partner_export_value + 1))
    df["trade_value"] = denominator
    df["log_trade_value"] = np.log1p(df.trade_value)
    df["lb_unit_value"] = np.where(qty_ok, df.lb_import_value / df.lb_qty, np.nan)
    df["partner_unit_value"] = np.where(qty_ok, df.partner_export_value / df.partner_qty, np.nan)
    df["unit_value_log_ratio"] = np.log((df.lb_unit_value + 1e-9) / (df.partner_unit_value + 1e-9))
    complete = df[both].copy()
    complete["robust_score"] = complete.groupby("year")["signed_log_ratio"].transform(robust_abs_z)
    complete["temporal_score_raw"] = complete.groupby(["partner_code", "hs_code"])["signed_log_ratio"].transform(robust_abs_z)
    complete["unit_score_raw"] = complete.groupby("year")["unit_value_log_ratio"].transform(robust_abs_z)
    features = complete[["symmetric_gap", "signed_log_ratio", "log_trade_value", "temporal_score_raw", "unit_score_raw"]].replace([np.inf, -np.inf], np.nan)
    features = features.fillna(features.median()).fillna(0)
    if len(features) >= 20:
        forest = IsolationForest(n_estimators=180, random_state=CONFIG["seed"], contamination="auto")
        complete["iforest_raw"] = -forest.fit(features).score_samples(features)
        neighbors = max(5, min(25, len(features) - 1))
        lof = LocalOutlierFactor(n_neighbors=neighbors)
        lof.fit_predict(features)
        complete["lof_raw"] = -lof.negative_outlier_factor_
    else:
        complete["iforest_raw"] = complete.symmetric_gap
        complete["lof_raw"] = complete.symmetric_gap
    complete["mirror_percentile"] = percentile(complete.robust_score)
    complete["temporal_percentile"] = percentile(complete.temporal_score_raw)
    complete["unit_percentile"] = percentile(complete.unit_score_raw)
    complete["ensemble_percentile"] = (percentile(complete.iforest_raw) + percentile(complete.lof_raw)) / 2
    complete["materiality_percentile"] = percentile(complete.abs_gap_usd)
    w = CONFIG["priority_score"]
    complete["investigation_priority"] = (
        w["mirror"] * complete.mirror_percentile
        + w["temporal"] * complete.temporal_percentile
        + w["unit_value"] * complete.unit_percentile
        + w["ensemble"] * complete.ensemble_percentile
        + w["materiality"] * complete.materiality_percentile
    ).clip(0, 100)
    complete["caveat_flags"] = complete.apply(caveats, axis=1)
    scored = df.merge(
        complete[
            [
                "year", "partner_code", "hs_code", "robust_score", "temporal_percentile", "unit_percentile",
                "ensemble_percentile", "materiality_percentile", "investigation_priority", "caveat_flags",
            ]
        ],
        on=["year", "partner_code", "hs_code"],
        how="left",
    )
    scored["investigation_priority"] = scored.investigation_priority.fillna(0)
    return scored.sort_values("investigation_priority", ascending=False)


def caveats(row: pd.Series) -> list[str]:
    flags = ["CIF/FOB valuation may explain part of the difference"]
    if row.get("lb_qty_unit") != row.get("partner_qty_unit") or pd.isna(row.get("unit_value_log_ratio")):
        flags.append("Quantity units are missing or not comparable")
    if row.get("lb_estimated") or row.get("partner_estimated"):
        flags.append("At least one quantity/value record carries an estimation flag")
    if row.get("symmetric_gap", 0) > 1.2:
        flags.append("Routing, re-exports, timing, or partner attribution may contribute")
    return flags


def synthetic_validation(scored: pd.DataFrame) -> dict:
    eligible = scored[scored.mirror_tier.isin(["A", "B"]) & scored.signed_log_ratio.notna()].copy()
    stable = eligible[eligible.symmetric_gap < 0.35]
    if len(stable) < 50:
        stable = eligible.nsmallest(max(50, len(eligible) // 4), "symmetric_gap")
    if len(stable) < 20:
        return {"injected": 0, "recall_at_5pct": None, "mean_percentile": None}
    sample = stable.sample(n=min(80, len(stable)), random_state=CONFIG["seed"])
    raise_lb = np.log((sample.lb_import_value * 5 + 1) / (sample.partner_export_value + 1)).abs()
    raise_partner = np.log((sample.lb_import_value + 1) / (sample.partner_export_value * 5 + 1)).abs()
    injected_ratio = np.maximum(raise_lb, raise_partner)
    reference = stable.signed_log_ratio.abs()
    injected_percentiles = injected_ratio.map(lambda value: float((reference <= value).mean() * 100))
    return {
        "injected": int(len(sample)),
        "stable_reference_n": int(len(stable)),
        "severity": "5× one-sided value perturbation on historically close mirror pairs",
        "recall_at_1pct": round(float((injected_percentiles >= 99).mean()), 3),
        "recall_at_5pct": round(float((injected_percentiles >= 95).mean()), 3),
        "mean_percentile": round(float(injected_percentiles.mean()), 1),
    }


def money(value: float) -> str:
    if value >= 1_000_000_000:
        return f"${value / 1_000_000_000:.1f}B"
    if value >= 1_000_000:
        return f"${value / 1_000_000:.1f}M"
    return f"${value:,.0f}"


def write_outputs(scored: pd.DataFrame, partners: list[int]) -> None:
    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    scored.to_parquet(ARTIFACTS / "mirror_pairs.parquet", index=False)
    top = scored[scored.mirror_tier.isin(["A", "B"])].head(24)
    validation = synthetic_validation(scored)
    anomalies = []
    for _, row in top.iterrows():
        anomalies.append(
            {
                "id": f"{int(row.year)}-{int(row.partner_code)}-{row.hs_code}",
                "score": round(float(row.investigation_priority), 1),
                "year": int(row.year),
                "partner": row.partner_name,
                "partnerCode": int(row.partner_code),
                "hs": row.hs_code,
                "product": row.hs_description,
                "imports": round(float(row.lb_import_value)),
                "exports": round(float(row.partner_export_value)),
                "gap": round(float(row.abs_gap_usd)),
                "gapRatio": round(float(row.symmetric_gap * 100), 1),
                "tier": row.mirror_tier,
                "components": {
                    "mirror": round(float(row.robust_score), 1),
                    "temporal": round(float(row.temporal_percentile), 1),
                    "unitValue": round(float(row.unit_percentile), 1),
                    "modelAgreement": round(float(row.ensemble_percentile), 1),
                    "materiality": round(float(row.materiality_percentile), 1),
                },
                "caveats": row.caveat_flags,
            }
        )
    complete = scored[scored.mirror_tier.isin(["A", "B"])]
    dashboard = {
        "generatedAt": pd.Timestamp.now(tz="UTC").isoformat(),
        "source": "UN Comtrade public preview API; HS 2017 (H5); annual data",
        "scope": (
            f"Top {CONFIG['top_partners']} import partners per year; "
            f"{min(CONFIG['years'])}–{max(CONFIG['years'])} feasibility sample"
        ),
        "summary": {
            "tradeAnalyzed": money(float(complete.trade_value.sum())),
            "mirrorPairs": int(len(complete)),
            "highPriority": int((complete.investigation_priority >= 85).sum()),
            "partners": int(complete.partner_code.nunique()),
            "products": int(complete.hs_code.nunique()),
            "tierA": int((scored.mirror_tier == "A").sum()),
            "tierB": int((scored.mirror_tier == "B").sum()),
            "tierC": int((scored.mirror_tier == "C").sum()),
        },
        "years": [int(year) for year in sorted(complete.year.unique())],
        "partnersSampled": partners,
        "anomalies": anomalies,
        "validation": validation,
        "claims": {
            "allowed": "Statistically unusual flows prioritized for contextual investigation.",
            "forbidden": "An anomaly is not evidence of fraud, smuggling, tax loss, or wrongdoing.",
        },
    }
    (ARTIFACTS / "dashboard.json").write_text(json.dumps(dashboard, indent=2))
    snapshot = {
        "generated_at": dashboard["generatedAt"],
        "api": "UN Comtrade public/v1/preview",
        "classification": CONFIG["classification"],
        "years": CONFIG["years"],
        "cache_files": len(list(CACHE.glob("*.json"))),
        "cache_sha256": hashlib.sha256("".join(sorted(p.read_text() for p in CACHE.glob("*.json"))).encode()).hexdigest(),
        "row_counts": dashboard["summary"],
    }
    (ROOT / "data/metadata/comtrade_snapshot.json").write_text(json.dumps(snapshot, indent=2))


def main() -> None:
    pairs, _, _, partners = acquire()
    scored = engineer(pairs)
    write_outputs(scored, partners)
    print((ARTIFACTS / "dashboard.json").read_text())


if __name__ == "__main__":
    main()
