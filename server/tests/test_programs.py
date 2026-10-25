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
        {"last_updated": ""},
        {"lender_name": ""},
    ],
    ids=lambda o: ",".join(f"{k}={v}" for k, v in o.items()),
)
def test_invalid_row_skipped_and_reported(tmp_path, overrides):
    path = write_csv(tmp_path, row(), row(**{"lender_name": "Bad", **overrides}), row(lender_name="After"))
    data = load_programs(path, date(2026, 1, 16), 7)

    assert [p.lender for p in data.programs] == ["L", "After"]
    [error] = data.data_errors
    assert error.line == 3
    # The message names the CSV column(s) an admin needs to fix.
    for column in overrides:
        assert column in error.message


def test_error_message_is_readable(tmp_path):
    path = write_csv(tmp_path, row(interest_rate_min="-10.6"), row(lender_name="X", min_loan_amount="300000"))
    messages = [e.message for e in load_programs(path, date(2026, 1, 16), 7).data_errors]
    assert messages == [
        "interest_rate_min: Input should be greater than or equal to 0 (got '-10.6')",
        "min_loan_amount/max_loan_amount: min (300000) is greater than max (250000)",
    ]


def test_multiple_problems_in_one_row_reported_together(tmp_path):
    path = write_csv(tmp_path, row(min_credit_score="9999", turnaround_days="-1"))
    [error] = load_programs(path, date(2026, 1, 16), 7).data_errors
    assert "min_credit_score" in error.message and "turnaround_days" in error.message


def test_unquoted_comma_reported(tmp_path):
    path = write_csv(tmp_path, row(special_requirements="Requires 10%, owner injection"))
    data = load_programs(path, date(2026, 1, 16), 7)
    assert data.programs == []
    assert "unquoted comma" in data.data_errors[0].message


def test_short_row_reported(tmp_path):
    path = write_csv(tmp_path, "L,P,10000,250000")
    data = load_programs(path, date(2026, 1, 16), 7)
    assert data.programs == []
    assert data.data_errors[0].line == 2


def test_missing_header_column_reported(tmp_path):
    path = tmp_path / "programs.csv"
    path.write_text(HEADER.replace("interest_rate_min,", "") + row() + "\n")
    data = load_programs(path, date(2026, 1, 16), 7)
    assert data.programs == []
    assert data.as_of is None
    assert data.data_errors[0].line == 1
    assert "interest_rate_min" in data.data_errors[0].message


def test_quoted_multiline_field_reports_correct_lines(tmp_path):
    path = write_csv(
        tmp_path,
        row(special_requirements='"Line one\nline two"'),
        row(lender_name="Bad", turnaround_days="-1"),
    )
    data = load_programs(path, date(2026, 1, 16), 7)
    assert data.programs[0].special_requirements == "Line one\nline two"
    assert data.data_errors[0].line == 4


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


def test_duplicate_keeps_first_and_reports_later(tmp_path):
    path = write_csv(tmp_path, row(turnaround_days="5"), row(turnaround_days="99"))
    data = load_programs(path, date(2026, 1, 16), 7)
    assert [p.turnaround_days for p in data.programs] == [5]
    [error] = data.data_errors
    assert error.line == 3
    assert error.message == "Duplicate of L P on line 2"


def test_sample_csv_loads():
    data = load_programs(DEFAULT_CSV, date(2026, 2, 8), 7)
    assert len(data.programs) == 49
    assert data.data_errors == []
    assert data.as_of == date(2026, 2, 8)
    assert "Construction" in data.facets.business_types


def test_api_uses_camel_case(monkeypatch):
    monkeypatch.setenv("REFERENCE_DATE", "2026-02-08")
    from app.main import app

    with TestClient(app) as client:
        body = client.get("/api/programs").json()

    assert body["asOf"] == "2026-02-08"
    assert body["referenceDate"] == "2026-02-08"
    assert body["dataErrors"] == []
    first = body["programs"][0]
    assert {"programType", "loanAmount", "ratesRecentlyUpdated", "eligibleBusinessTypes"} <= first.keys()


def test_server_starts_and_serves_valid_rows_when_csv_has_bad_rows(tmp_path, monkeypatch, caplog):
    path = write_csv(
        tmp_path,
        row(lender_name="Good One"),
        row(lender_name="Negative Rate", interest_rate_min="-1"),
        row(lender_name="Good Two"),
        row(lender_name="Bad Date", last_updated="13/45/2026"),
        row(lender_name="Good One"),
    )
    monkeypatch.setenv("PROGRAMS_CSV", str(path))
    monkeypatch.setenv("REFERENCE_DATE", "2026-01-16")
    from app.main import app

    with TestClient(app) as client:
        assert client.get("/healthz").status_code == 200
        res = client.get("/api/programs")

    assert res.status_code == 200
    body = res.json()
    assert [p["lender"] for p in body["programs"]] == ["Good One", "Good Two"]
    assert [(e["line"], e["message"].split(":")[0]) for e in body["dataErrors"]] == [
        (3, "interest_rate_min"),
        (5, "last_updated"),
        (6, "Duplicate of Good One P on line 2"),
    ]
    assert "Skipped programs.csv line 3" in caplog.text
