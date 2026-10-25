from datetime import date
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import DEFAULT_CSV
from app.programs import load_programs

HEADER = (
    "lender_name,program_type,min_loan_amount,max_loan_amount,min_credit_score,"
    "credit_tier_required,min_years_in_business,interest_rate_min,interest_rate_max,"
    "max_term_months,sba_guarantee_pct,eligible_business_types,requires_collateral,"
    "max_existing_debt_ratio,turnaround_days,special_requirements,last_updated\n"
)


def write_csv(tmp_path: Path, *rows: str) -> Path:
    path = tmp_path / "programs.csv"
    path.write_text(HEADER + "\n".join(rows) + "\n")
    return path


def test_parses_row_into_typed_program(tmp_path):
    path = write_csv(
        tmp_path,
        "First National Bank,SBA Express,25000,350000,680,Good,2,11.4,12.5,84,50,All,No,,13,,1/2/2026",
    )
    [p] = load_programs(path, date(2026, 1, 5), 7).programs

    assert p.id == "first-national-bank--sba-express"
    assert p.loan_amount.min == 25000 and p.loan_amount.max == 350000
    assert p.interest_rate.min == 11.4
    assert p.credit_tier == "good"
    assert p.eligible_business_types is None
    assert p.collateral == "no"
    assert p.max_debt_ratio is None
    assert p.special_requirements is None
    assert p.last_updated == date(2026, 1, 2)


def test_single_business_type_becomes_list(tmp_path):
    path = write_csv(
        tmp_path,
        "Lender,504 Loan,1,2,600,Fair,1,5,6,240,40,Manufacturing,Yes,0.5,10,Note,1/1/2026",
    )
    [p] = load_programs(path, date(2026, 1, 1), 7).programs
    assert p.eligible_business_types == ["Manufacturing"]
    assert p.max_debt_ratio == 0.5


@pytest.mark.parametrize(
    ("updated", "expected"),
    [("1/10/2026", True), ("1/3/2026", True), ("1/2/2026", False), ("1/11/2026", False)],
)
def test_recently_updated_window(tmp_path, updated, expected):
    path = write_csv(tmp_path, f"L,P,1,2,600,Fair,1,5,6,12,40,All,No,,1,,{updated}")
    [p] = load_programs(path, date(2026, 1, 10), 7).programs
    assert p.rates_recently_updated is expected


VALID_ROW = {
    "lender_name": "L",
    "program_type": "P",
    "min_loan_amount": "10000",
    "max_loan_amount": "250000",
    "min_credit_score": "620",
    "credit_tier_required": "Fair",
    "min_years_in_business": "1",
    "interest_rate_min": "11",
    "interest_rate_max": "13.6",
    "max_term_months": "84",
    "sba_guarantee_pct": "85",
    "eligible_business_types": "All",
    "requires_collateral": "Varies",
    "max_existing_debt_ratio": "0.5",
    "turnaround_days": "23",
    "special_requirements": "",
    "last_updated": "1/16/2026",
}


def row(**overrides: str) -> str:
    return ",".join({**VALID_ROW, **overrides}.values())


def test_valid_row_fixture_loads(tmp_path):
    assert len(load_programs(write_csv(tmp_path, row()), date(2026, 1, 16), 7).programs) == 1


@pytest.mark.parametrize(
    "overrides",
    [
        {"interest_rate_min": "-1"},
        {"interest_rate_min": "-2", "interest_rate_max": "-1"},
        {"interest_rate_min": "14", "interest_rate_max": "13"},
        {"min_loan_amount": "-10000"},
        {"min_loan_amount": "300000", "max_loan_amount": "250000"},
        {"min_credit_score": "299"},
        {"min_credit_score": "851"},
        {"min_credit_score": "-620"},
        {"min_credit_score": "9999"},
        {"min_years_in_business": "-1"},
        {"max_term_months": "0"},
        {"sba_guarantee_pct": "101"},
        {"sba_guarantee_pct": "-5"},
        {"max_existing_debt_ratio": "-0.1"},
        {"turnaround_days": "-3"},
        {"credit_tier_required": "Platinum"},
        {"requires_collateral": "Maybe"},
        {"interest_rate_min": "abc"},
        {"min_credit_score": ""},
        {"last_updated": "2026-13-45"},
    ],
    ids=lambda o: ",".join(f"{k}={v}" for k, v in o.items()),
)
def test_invalid_values_rejected_with_line_number(tmp_path, overrides):
    path = write_csv(tmp_path, row(), row(lender_name="Bad", **overrides))
    with pytest.raises(ValueError, match="programs.csv line 3"):
        load_programs(path, date(2026, 1, 16), 7)


@pytest.mark.parametrize(
    "overrides",
    [
        {"interest_rate_min": "0", "interest_rate_max": "0"},
        {"min_loan_amount": "250000", "max_loan_amount": "250000"},
        {"min_credit_score": "300"},
        {"min_credit_score": "850"},
        {"min_years_in_business": "0"},
        {"min_years_in_business": "0.5"},
        {"sba_guarantee_pct": "0"},
        {"sba_guarantee_pct": "100"},
        {"max_existing_debt_ratio": ""},
        {"turnaround_days": "0"},
        {"credit_tier_required": " good "},
        {"requires_collateral": "YES"},
    ],
    ids=lambda o: ",".join(f"{k}={v}" for k, v in o.items()),
)
def test_boundary_values_accepted(tmp_path, overrides):
    assert len(load_programs(write_csv(tmp_path, row(**overrides)), date(2026, 1, 16), 7).programs) == 1


def test_blank_lines_skipped(tmp_path):
    path = write_csv(tmp_path, row(), "", ",,,,,,,,,,,,,,,,", row(lender_name="Other"))
    assert len(load_programs(path, date(2026, 1, 16), 7).programs) == 2


def test_duplicate_ids_rejected(tmp_path):
    row = "L,P,1,2,600,Fair,1,5,6,12,40,All,No,,1,,1/1/2026"
    with pytest.raises(ValueError, match="Duplicate"):
        load_programs(write_csv(tmp_path, row, row), date(2026, 1, 1), 7)


def test_sample_csv_loads():
    data = load_programs(DEFAULT_CSV, date(2026, 2, 8), 7)
    assert len(data.programs) == 49
    assert data.as_of == date(2026, 2, 8)
    assert "Construction" in data.facets.business_types


def test_api_uses_camel_case(monkeypatch):
    monkeypatch.setenv("REFERENCE_DATE", "2026-02-08")
    from app.main import app

    with TestClient(app) as client:
        body = client.get("/api/programs").json()

    assert body["asOf"] == "2026-02-08"
    assert body["referenceDate"] == "2026-02-08"
    first = body["programs"][0]
    assert {"programType", "loanAmount", "ratesRecentlyUpdated", "eligibleBusinessTypes"} <= first.keys()
