# appelé par le handler Load : requêtes SQL sur la table sites (lecture des ids, insertion)
from __future__ import annotations

import pandas as pd
from psycopg2.extensions import connection as Connection

SITE_COLUMNS = ["site_id", "site_type", "site_name", "location", "capacity_kw", "status"]


def get_existing_site_ids(conn: Connection) -> set[str]:
    with conn.cursor() as cursor:
        cursor.execute("SELECT site_id FROM sites")
        return {row[0] for row in cursor.fetchall()}


def insert_sites(conn: Connection, sites: pd.DataFrame) -> int:
    if sites.empty:
        return 0
    rows = list(sites[SITE_COLUMNS].itertuples(index=False, name=None))
    with conn.cursor() as cursor:
        cursor.executemany(
            """
            INSERT INTO sites (site_id, site_type, site_name, location, capacity_kw, status)
            VALUES (%s, %s, %s, %s, %s, %s)
            """,
            rows,
        )
    conn.commit()
    return len(rows)
