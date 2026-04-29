from __future__ import annotations

import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import api_router
from app.repositories.csv_repository import CsvFinancialRepository


def create_app(*, data_dir: str | Path | None = None, seed_demo: bool = True) -> FastAPI:
    app = FastAPI(title="Financial Modeling MVP", version="0.1.0")

    allowed_origins = [
        origin.strip()
        for origin in os.getenv(
            "ALLOWED_ORIGINS",
            "http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173",
        ).split(",")
        if origin.strip()
    ]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    default_data_dir = Path(__file__).resolve().parents[1] / "data"
    resolved_data_dir = Path(data_dir) if data_dir else Path(os.getenv("DATA_DIR", default_data_dir))
    repository = CsvFinancialRepository(resolved_data_dir)
    repository.initialize(seed_demo=seed_demo)

    app.state.repository = repository
    app.include_router(api_router)
    return app


app = create_app()
