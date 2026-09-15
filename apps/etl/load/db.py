# appelé par le handler Load : ouvre une connexion PostgreSQL depuis la config Load
from __future__ import annotations

import psycopg2
from psycopg2.extensions import connection as Connection

from load.config import get_postgres_connection_params


def get_connection() -> Connection:
    return psycopg2.connect(**get_postgres_connection_params())
