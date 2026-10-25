"""Load the lender program CSV into typed, frontend-ready records.

The CSV is parsed once at startup. Everything the frontend needs (clean
numbers, ISO dates, enums, nulls for blanks, stable ids) is resolved here so
the browser never has to deal with raw CSV quirks.

Malformed rows are skipped and reported as data errors rather than failing
startup, so one bad row doesn't take the whole tool down mid-call.
"""

import csv
import re
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator, model_validator
from pydantic.alias_generators import to_camel

CreditTier = Literal["fair", "good", "excellent"]
Collateral = Literal["yes", "no", "varies"]

# Ordered lowest to highest; a borrower qualifies for any tier at or below theirs.
CREDIT_TIERS: list[CreditTier] = ["fair", "good", "excellent"]

REQUIRED_COLUMNS = [
    "lender_name",
    "program_type",
    "min_loan_amount",
    "max_loan_amount",
    "min_credit_score",
    "credit_tier_required",
    "min_years_in_business",
    "interest_rate_min",
    "interest_rate_max",
    "max_term_months",
    "sba_guarantee_pct",
    "eligible_business_types",
    "requires_collateral",
    "max_existing_debt_ratio",
    "turnaround_days",
    "special_requirements",
    "last_updated",
]

# Program field paths mapped back to the CSV columns an admin would edit.
FIELD_COLUMNS: dict[tuple[str, ...], str] = {
    ("lender",): "lender_name",
    ("program_type",): "program_type",
    ("loan_amount",): "min_loan_amount/max_loan_amount",
    ("loan_amount", "min"): "min_loan_amount",
    ("loan_amount", "max"): "max_loan_amount",
    ("interest_rate",): "interest_rate_min/interest_rate_max",
    ("interest_rate", "min"): "interest_rate_min",
    ("interest_rate", "max"): "interest_rate_max",
    ("credit_tier",): "credit_tier_required",
    ("collateral",): "requires_collateral",
    ("max_debt_ratio",): "max_existing_debt_ratio",
}


class ApiModel(BaseModel):
    # inf/nan would serialize to JSON null and break the frontend's math.
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, allow_inf_nan=False)


NonNegative = Annotated[float, Field(ge=0)]
NonBlank = Annotated[str, Field(min_length=1)]


class Range(ApiModel):
    min: NonNegative
    max: NonNegative

    @model_validator(mode="after")
    def _ordered(self) -> "Range":
        if self.min > self.max:
            raise ValueError(f"min ({self.min:g}) is greater than max ({self.max:g})")
        return self


class Program(ApiModel):
    id: str
    lender: NonBlank
    program_type: NonBlank
    loan_amount: Range
    interest_rate: Range
    min_credit_score: Annotated[int, Field(ge=300, le=850)]
    credit_tier: CreditTier
    min_years_in_business: NonNegative
    max_term_months: Annotated[int, Field(gt=0)]
    sba_guarantee_pct: Annotated[int, Field(ge=0, le=100)]
    # None means the program accepts all business types.
    eligible_business_types: list[NonBlank] | None
    collateral: Collateral
    max_debt_ratio: Annotated[float, Field(ge=0)] | None
    turnaround_days: Annotated[int, Field(ge=0)]
    special_requirements: str | None
    last_updated: date
    rates_recently_updated: bool = False

    @field_validator("last_updated", mode="before")
    @classmethod
    def _parse_us_date(cls, value: Any) -> Any:
        if isinstance(value, str):
            try:
                return datetime.strptime(value, "%m/%d/%Y").date()
            except ValueError:
                raise ValueError("expected a date like 1/31/2026") from None
        return value


class DataError(ApiModel):
    line: int
    message: str


class Facets(ApiModel):
    business_types: list[str]
    program_types: list[str]
    credit_tiers: list[CreditTier]


class ProgramsResponse(ApiModel):
    # None when no rows loaded.
    as_of: date | None
    reference_date: date
    recent_update_days: int
    facets: Facets
    programs: list[Program]
    # Rows that were skipped; the frontend shows these so reps know results are incomplete.
    data_errors: list[DataError]


def slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def _cell(row: dict[str | None, Any], column: str) -> str:
    # Short rows leave trailing columns as None.
    return (row.get(column) or "").strip()


def _parse_row(row: dict[str | None, Any]) -> Program:
    # Spreadsheet exports often add trailing commas; only non-blank extra values signal misaligned columns.
    extra = [v for v in row.get(None) or [] if v.strip()]
    if extra:
        raise ValueError(
            f"has {len(extra)} more value(s) than there are columns; check for an unquoted comma"
        )

    lender = _cell(row, "lender_name")
    program_type = _cell(row, "program_type")
    business_types = _cell(row, "eligible_business_types")
    return Program.model_validate(
        {
            "id": f"{slugify(lender)}--{slugify(program_type)}",
            "lender": lender,
            "program_type": program_type,
            "loan_amount": {"min": _cell(row, "min_loan_amount"), "max": _cell(row, "max_loan_amount")},
            "interest_rate": {"min": _cell(row, "interest_rate_min"), "max": _cell(row, "interest_rate_max")},
            "min_credit_score": _cell(row, "min_credit_score"),
            "credit_tier": _cell(row, "credit_tier_required").lower(),
            "min_years_in_business": _cell(row, "min_years_in_business"),
            "max_term_months": _cell(row, "max_term_months"),
            "sba_guarantee_pct": _cell(row, "sba_guarantee_pct"),
            "eligible_business_types": None if business_types.lower() == "all" else [business_types],
            "collateral": _cell(row, "requires_collateral").lower(),
            "max_debt_ratio": _cell(row, "max_existing_debt_ratio") or None,
            "turnaround_days": _cell(row, "turnaround_days"),
            "special_requirements": _cell(row, "special_requirements") or None,
            "last_updated": _cell(row, "last_updated"),
        }
    )


def _describe(error: ValidationError) -> str:
    parts = []
    for e in error.errors():
        # Drop list indexes (eligible_business_types.0) so paths map to CSV columns.
        loc = tuple(str(part) for part in e["loc"] if not isinstance(part, int))
        column = FIELD_COLUMNS.get(loc, ".".join(loc))
        message = e["msg"].removeprefix("Value error, ")
        got = f" (got {e['input']!r})" if isinstance(e.get("input"), str) else ""
        parts.append(f"{column}: {message}{got}")
    return "; ".join(parts)


def load_programs(csv_path: Path, reference_date: date, recent_update_days: int) -> ProgramsResponse:
    programs: list[Program] = []
    errors: list[DataError] = []
    first_seen: dict[str, int] = {}

    with csv_path.open(newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        missing = [c for c in REQUIRED_COLUMNS if c not in (reader.fieldnames or [])]
        if missing:
            errors.append(DataError(line=1, message=f"Header is missing column(s): {', '.join(missing)}"))
        else:
            for row in reader:
                line = reader.line_num
                if not any(isinstance(v, str) and v.strip() for v in row.values()):
                    continue
                try:
                    program = _parse_row(row)
                except ValidationError as e:
                    errors.append(DataError(line=line, message=_describe(e)))
                    continue
                except ValueError as e:
                    errors.append(DataError(line=line, message=f"Row {e}"))
                    continue

                if program.id in first_seen:
                    errors.append(
                        DataError(
                            line=line,
                            message=f"Duplicate of {program.lender} {program.program_type} on line {first_seen[program.id]}",
                        )
                    )
                    continue
                first_seen[program.id] = line
                programs.append(program)

    cutoff = reference_date - timedelta(days=recent_update_days)
    for p in programs:
        p.rates_recently_updated = cutoff <= p.last_updated <= reference_date

    business_types = {t for p in programs for t in p.eligible_business_types or []}
    return ProgramsResponse(
        as_of=max((p.last_updated for p in programs), default=None),
        reference_date=reference_date,
        recent_update_days=recent_update_days,
        facets=Facets(
            business_types=sorted(business_types),
            program_types=sorted({p.program_type for p in programs}),
            credit_tiers=CREDIT_TIERS,
        ),
        programs=programs,
        data_errors=errors,
    )
