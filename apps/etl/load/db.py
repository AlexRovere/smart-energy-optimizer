# appelé par le handler Load : ouvre une connexion PostgreSQL depuis la config Load
from __future__ import annotations

import psycopg2

# noqa volontaire : psycopg2 expose son type de connexion sous un nom en
# minuscules. L'aliaser en Connection est la forme conventionnelle pour s'en
# servir en annotation, et la renommer rendrait les annotations moins lisibles.
from psycopg2.extensions import connection as Connection  # noqa: N812

from load.config import get_postgres_connection_params


def get_connection() -> Connection:
    return psycopg2.connect(**get_postgres_connection_params())
