# SBA Program Finder

A single-page tool for sales reps. Enter what the borrower has told you and see the SBA loan programs they qualify for, updating as you type.

- `server/`: FastAPI. Loads `data/programs.csv` once at startup, converts it to clean typed JSON, and serves it at `GET /api/programs`.
- `web/`: React + TypeScript + Vite. Loads the whole dataset once, then filters and sorts it in the browser. Filters, sort, and the expanded program are stored in the URL, so a link reproduces the same view.

## Running locally

Requires [uv](https://docs.astral.sh/uv/) and Node 20+.

```sh
# API on :8000
cd server
uv sync
REFERENCE_DATE=2026-02-08 uv run uvicorn app.main:app --reload

# Frontend on :5173 (forwards /api to :8000)
cd web
npm install
npm run dev
```

Open http://localhost:5173.

### Configuration (server env vars)

| Variable | Default | Purpose |
| --- | --- | --- |
| `PROGRAMS_CSV` | `data/programs.csv` | Path to the lender program CSV |
| `REFERENCE_DATE` | today | The date treated as "today" when deciding which rates are new. The sample data is from Jan–Feb 2026, so set this to `2026-02-08` to see the "New rates" badges. |
| `RECENT_UPDATE_DAYS` | `7` | How many days a program shows the "New rates" badge after an update |

## Tests

```sh
cd server && uv run pytest
cd web && npm test
```

The frontend scenario tests (`web/src/scenarios.test.ts`) run against `web/src/__fixtures__/programs.json`, a copy of the API response for the sample CSV. If `data/programs.csv` changes, regenerate it with the command below, then update the expected results in those tests:

```sh
cd server && uv run python -c "
from datetime import date
from app.main import DEFAULT_CSV
from app.programs import load_programs
print(load_programs(DEFAULT_CSV, date(2026, 2, 8), 7).model_dump_json(by_alias=True, indent=1))
" > ../web/src/__fixtures__/programs.json
```

Malformed CSV rows (negative rates, a min above its max, a credit score outside 300–850, an unknown tier, an unquoted comma, a duplicate lender/program, etc.) are skipped rather than stopping the server. Each one is logged at startup and returned in `dataErrors`, and the frontend shows them in a banner telling reps to contact an admin. Once there's an upload flow, bad data should be rejected at upload time instead (see open question 17).

## API

`GET /api/programs`

```jsonc
{
  "asOf": "2026-02-08",          // most recent last_updated in the data; null if no rows loaded
  "referenceDate": "2026-02-08", // the "today" used for ratesRecentlyUpdated
  "recentUpdateDays": 7,
  "facets": { "businessTypes": [...], "programTypes": [...], "creditTiers": ["fair", "good", "excellent"] },
  "programs": [{
    "id": "first-national-bank--community-advantage",
    "lender": "First National Bank",
    "programType": "Community Advantage",
    "loanAmount": { "min": 10000, "max": 250000 },
    "interestRate": { "min": 11.0, "max": 13.6 },
    "minCreditScore": 620,
    "creditTier": "fair",
    "minYearsInBusiness": 1,
    "maxTermMonths": 84,
    "sbaGuaranteePct": 85,
    "eligibleBusinessTypes": null,     // null = all types
    "collateral": "varies",            // yes | no | varies
    "maxDebtRatio": 0.5,               // null when blank in the CSV
    "turnaroundDays": 23,
    "specialRequirements": "No recent bankruptcies (7 years)",
    "lastUpdated": "2026-01-16",
    "ratesRecentlyUpdated": false
  }],
  "dataErrors": [                // rows that were skipped; empty when the CSV is clean
    { "line": 5, "message": "interest_rate_min: Input should be greater than or equal to 0 (got '-10.6')" }
  ]
}
```

`GET /healthz` returns `{"status": "ok"}`.

## URL parameters

`amount`, `business`, `years`, `tier` or `score` (only one is used), `program` (can repeat), `sort` (`rate` | `turnaround` | `term` | `guarantee`), `open` (program id).

Example: `/?amount=250000&business=Restaurant%2FFood+Service&years=2&tier=good&open=heritage-credit-union--sba-express`

## Open questions

See [docs/open-questions.md](docs/open-questions.md).
