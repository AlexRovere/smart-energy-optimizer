# appelé par le handler Load : requêtes SQL sur la table sites (lecture des ids, insertion)
# table créée par Drizzle côté applicatif (docs/data.md) : l'ETL ne la crée jamais
from __future__ import annotations

import pandas as pd
from psycopg2.extensions import connection as Connection

SITE_COLUMNS = ["id", "type", "name", "location", "capacity_kw", "status"]


def get_existing_site_ids(conn: Connection) -> set[str]:
    with conn.cursor() as cursor:
        cursor.execute("SELECT id FROM sites")
        return {row[0] for row in cursor.fetchall()}


def insert_sites(conn: Connection, sites: pd.DataFrame) -> int:
    if sites.empty:
        return 0
    rows = list(sites[SITE_COLUMNS].itertuples(index=False, name=None))
    with conn.cursor() as cursor:
        cursor.executemany(
            """
            INSERT INTO sites (id, type, name, location, capacity_kw, status)
            VALUES (%s, %s, %s, %s, %s, %s)
            """,
            rows,
        )
    conn.commit()
    return len(rows)
