# point d'entrée CLI : orchestre extract -> transform -> load pour chaque commande exposée
from __future__ import annotations

import argparse

from env_loader import load_root_env
from extract.handler import fetch_sites
from load.handler import load_sites, load_sites_to_db
from transform.handler import dedupe_sites, transform_sites


def run_sites(sync_db: bool = False) -> dict[str, object]:
    raw = fetch_sites()
    transformed = transform_sites(raw)
    result: dict[str, object] = {"parquet_file": load_sites(transformed)}

    if sync_db:
        deduped = dedupe_sites(transformed)
        result["db_inserted"] = load_sites_to_db(deduped)

    return result


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="ETL enerVision")
    subparsers = parser.add_subparsers(dest="command", required=True)

    sites_parser = subparsers.add_parser(
        "sites", help="Extract, transform and load the sites reference data"
    )
    sites_parser.add_argument(
        "--sync-db",
        action="store_true",
        help="Also add missing sites to the PostgreSQL sites table (secondary, opt-in)",
    )

    return parser


def main() -> None:
    load_root_env()
    args = build_parser().parse_args()

    if args.command == "sites":
        result = run_sites(sync_db=args.sync_db)
        print(f"Sites reference data written to {result['parquet_file']}")
        if args.sync_db:
            print(f"{result['db_inserted']} new site(s) added to PostgreSQL")


if __name__ == "__main__":
    main()
