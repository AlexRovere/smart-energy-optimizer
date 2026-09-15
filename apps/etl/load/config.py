# appelé par le handler Load : expose la config de sortie (répertoire Parquet, connexion PostgreSQL)
from __future__ import annotations

import os


def get_output_dir() -> str:
    output_dir = os.getenv("PARQUET_DIR")
    if not output_dir:
        raise RuntimeError("PARQUET_DIR is not set")
    return output_dir


def get_postgres_connection_params() -> dict[str, str]:
    params = {
        "host": os.getenv("POSTGRES_HOST"),
        "port": os.getenv("POSTGRES_PORT"),
        "dbname": os.getenv("POSTGRES_DB"),
        "user": os.getenv("POSTGRES_USER"),
        "password": os.getenv("POSTGRES_PASSWORD"),
    }
    missing = [key for key, value in params.items() if not value]
    if missing:
        raise RuntimeError(f"Missing Postgres environment variables: {', '.join(missing)}")
    return params
