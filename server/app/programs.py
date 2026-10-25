"""Load the lender program CSV into typed, frontend-ready records.

The CSV is parsed once at startup. Everything the frontend needs (clean
numbers, ISO dates, enums, nulls for blanks, stable ids) is resolved here so
the browser never has to deal with raw CSV quirks.
"""

import csv
import re
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator
from pydantic.alias_generators import to_camel

CreditTier = Literal["fair", "good", "excellent"]
Collateral = Literal["yes", "no", "varies"]

# Ordered lowest to highest; a borrower qualifies for any tier at or below theirs.
CREDIT_TIERS: list[CreditTier] = ["fair", "good", "excellent"]


class ApiModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


NonNegative = Annotated[float, Field(ge=0)]


class Range(ApiModel):
    min: NonNegative
    max: NonNegative

    @model_validator(mode="after")
    def _ordered(self) -> "Range":
        if self.min > self.max:
            raise ValueError(f"min ({self.min}) is greater than max ({self.max})")
        return self


class Program(ApiModel):
    id: str
    lender: str
    program_type: str
    loan_amount: Range
    interest_rate: Range
    min_credit_score: Annotated[int, Field(ge=300, le=850)]
    credit_tier: CreditTier
    min_years_in_business: NonNegative
    max_term_months: Annotated[int, Field(gt=0)]
    sba_guarantee_pct: Annotated[int, Field(ge=0, le=100)]
    # None means the program accepts all business types.
    eligible_business_types: list[str] | None
    collateral: Collateral
    max_debt_ratio: Annotated[float, Field(ge=0)] | None
    turnaround_days: Annotated[int, Field(ge=0)]
    special_requirements: str | None
    last_updated: date
    rates_recently_updated: bool


class Facets(ApiModel):
    business_types: list[str]
    program_types: list[str]
    credit_tiers: list[CreditTier]


class ProgramsResponse(ApiModel):
    as_of: date
    reference_date: date
    recent_update_days: int
    facets: Facets
    programs: list[Program]


def slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def _optional(value: str) -> str | None:
    value = value.strip()
    return value or None


def _parse_row(row: dict[str, str], reference_date: date, recent_update_days: int) -> Program:
    lender = row["lender_name"].strip()
    program_type = row["program_type"].strip()
    business_types = row["eligible_business_types"].strip()
    debt_ratio = _optional(row["max_existing_debt_ratio"])
    last_updated = datetime.strptime(row["last_updated"].strip(), "%m/%d/%Y").date()
    cutoff = reference_date - timedelta(days=recent_update_days)

    return Program(
        id=f"{slugify(lender)}--{slugify(program_type)}",
        lender=lender,
        program_type=program_type,
        loan_amount={"min": row["min_loan_amount"], "max": row["max_loan_amount"]},
        interest_rate={"min": row["interest_rate_min"], "max": row["interest_rate_max"]},
        min_credit_score=int(row["min_credit_score"]),
        credit_tier=row["credit_tier_required"].strip().lower(),
        min_years_in_business=float(row["min_years_in_business"]),
        max_term_months=int(row["max_term_months"]),
        sba_guarantee_pct=int(row["sba_guarantee_pct"]),
        eligible_business_types=None if business_types.lower() == "all" else [business_types],
        collateral=row["requires_collateral"].strip().lower(),
        max_debt_ratio=float(debt_ratio) if debt_ratio else None,
        turnaround_days=int(row["turnaround_days"]),
        special_requirements=_optional(row["special_requirements"]),
        last_updated=last_updated,
        rates_recently_updated=cutoff <= last_updated <= reference_date,
    )


def load_programs(csv_path: Path, reference_date: date, recent_update_days: int) -> ProgramsResponse:
    programs: list[Program] = []
    with csv_path.open(newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if not any(v.strip() for v in row.values() if v):
                continue
            # Fail loudly on bad data rather than show reps a wrong program.
            try:
                programs.append(_parse_row(row, reference_date, recent_update_days))
            except ValueError as e:
                raise ValueError(f"{csv_path.name} line {reader.line_num}: {e}") from e

    ids = [p.id for p in programs]
    duplicates = {i for i in ids if ids.count(i) > 1}
    if duplicates:
        raise ValueError(f"Duplicate lender/program combinations in CSV: {sorted(duplicates)}")

    business_types = {t for p in programs for t in p.eligible_business_types or []}
    return ProgramsResponse(
        as_of=max(p.last_updated for p in programs),
        reference_date=reference_date,
        recent_update_days=recent_update_days,
        facets=Facets(
            business_types=sorted(business_types),
            program_types=sorted({p.program_type for p in programs}),
            credit_tiers=CREDIT_TIERS,
        ),
        programs=programs,
    )
