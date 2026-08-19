import importlib.util
from pathlib import Path

import pandas as pd


SPEC = importlib.util.spec_from_file_location("pipeline", Path(__file__).parents[1] / "src/pipeline.py")
pipeline = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(pipeline)


def test_pairing_requires_exact_year_partner_and_hs():
    left = pd.DataFrame([{"year": 2024, "partner_code": 250, "hs_code": "8703", "lb_import_value": 100.0}])
    right = pd.DataFrame(
        [
            {"year": 2024, "partner_code": 250, "hs_code": "8703", "partner_export_value": 80.0},
            {"year": 2023, "partner_code": 250, "hs_code": "8703", "partner_export_value": 900.0},
        ]
    )
    paired = left.merge(right, on=["year", "partner_code", "hs_code"], how="outer")
    assert len(paired) == 2
    assert paired.loc[paired.year.eq(2024), "partner_export_value"].item() == 80.0


def test_gap_metrics_and_score_bounds():
    pairs = pd.DataFrame(
        [
            {
                "year": 2024, "partner_code": code, "hs_code": f"87{code:02d}", "partner_name": "Test",
                "hs_description": "Fixture", "lb_import_value": 100.0 + code, "partner_export_value": 80.0,
                "lb_qty": 10.0, "partner_qty": 10.0, "lb_qty_unit": 8, "partner_qty_unit": 8,
                "lb_net_weight": 10.0, "partner_net_weight": 10.0, "lb_estimated": False,
                "partner_estimated": False,
            }
            for code in range(1, 31)
        ]
    )
    scored = pipeline.engineer(pairs)
    assert scored.investigation_priority.between(0, 100).all()
    row = scored.loc[scored.partner_code.eq(1)].iloc[0]
    assert round(row.abs_gap_usd, 6) == 21.0
    assert row.mirror_tier == "A"

