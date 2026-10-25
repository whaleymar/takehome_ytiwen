import os
from contextlib import asynccontextmanager
from datetime import date
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.gzip import GZipMiddleware

from app.programs import ProgramsResponse, load_programs

DEFAULT_CSV = Path(__file__).resolve().parents[2] / "data" / "programs.csv"


def _settings() -> tuple[Path, date, int]:
    csv_path = Path(os.environ.get("PROGRAMS_CSV", DEFAULT_CSV))
    # REFERENCE_DATE pins "today" so the sample snapshot can be demoed as if it were current.
    ref = os.environ.get("REFERENCE_DATE")
    reference_date = date.fromisoformat(ref) if ref else date.today()
    recent_update_days = int(os.environ.get("RECENT_UPDATE_DAYS", "7"))
    return csv_path, reference_date, recent_update_days


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.programs = load_programs(*_settings())
    yield


app = FastAPI(title="SBA Program Finder", lifespan=lifespan)
app.add_middleware(GZipMiddleware, minimum_size=1000)


@app.get("/api/programs", response_model=ProgramsResponse, response_model_by_alias=True)
def get_programs() -> ProgramsResponse:
    return app.state.programs


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok"}
