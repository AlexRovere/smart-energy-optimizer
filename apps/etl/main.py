# point d'entrée CLI : orchestre extract -> transform -> load pour chaque commande exposée
from __future__ import annotations

import argparse
import sys
from datetime import date, datetime, timedelta, timezone

import pandas as pd

from env_loader import load_root_env
from extract.handler import fetch_readings, fetch_sites
from extract.readings import plan_fetch_windows, resolve_time_range
from load.handler import (
    get_context_days,
    get_existing_days,
    load_readings,
    load_sites,
    load_sites_to_db,
)
from progress import ProgressReporter
from run_log import RunLogger
from transform.handler import dedupe_sites, transform_sites
from transform.readings import transform_readings

# contexte minimal pour que le forward-fill inter-journalier reste correct sur un run incremental
CONTEXT_DAYS = 1


def run_sites(sync_db: bool = False) -> dict[str, object]:
    with RunLogger("sites") as logger:
        with logger.phase("extract") as phase:
            raw = fetch_sites()
            phase.rows(len(raw))

        with logger.phase("transform") as phase:
            transformed = transform_sites(raw)
            phase.rows(len(transformed))

        with logger.phase("load") as phase:
            result: dict[str, object] = {"parquet_file": load_sites(transformed)}
            phase.rows(len(transformed))

            if sync_db:
                deduped = dedupe_sites(transformed)
                result["db_inserted"] = load_sites_to_db(deduped)

    return result


def run_periods(
    start_time: datetime | None = None,
    end_time: datetime | None = None,
    verbose: bool = False,
    skip_coverage_check: bool = False,
    command: str = "periods",
) -> dict[str, object]:
    reporter = ProgressReporter(enabled=verbose)
    reporter.start()

    with RunLogger(command) as logger:
        with logger.phase("extract") as phase:
            sites = fetch_sites()
            site_ids = sites["site_id"].tolist() if not sites.empty else []
            # site par site : chaque site peut avoir une couverture differente sur le disque. Avec
            # skip_coverage_check, la fenetre demandee est toujours refetchee (cas du jour en cours,
            # deja partiellement couvert par un run horaire precedent)
            already_covered_days = (
                {site_id: set() for site_id in site_ids}
                if skip_coverage_check
                else {site_id: get_existing_days(site_id) for site_id in site_ids}
            )

            resolved_start, resolved_end = resolve_time_range(start_time, end_time)
            # declaree avant l'appel reseau : si l'extraction casse, la ligne d'erreur porte
            # quand meme la fenetre qui etait demandee
            phase.requested(resolved_start, resolved_end)
            fetch_plans = {
                site_id: plan_fetch_windows(
                    resolved_start, resolved_end, already_covered_days[site_id]
                )
                for site_id in site_ids
            }

            if verbose:
                total_windows = sum(len(windows) for windows in fetch_plans.values())
                reporter.set_extract_total(total_windows)
                # meme estimation pour le load : un fichier par (site, jour) reellement extrait,
                # a l'exces eventuel pres si les bornes ne tombent pas exactement sur des jours
                # calendaires
                reporter.set_load_total(total_windows)

            reporter.set_step("extract")
            raw = fetch_readings(
                start_time=start_time,
                end_time=end_time,
                on_window=reporter.tick_extract,
                already_covered_days=already_covered_days,
            )
            phase.measure(raw, site_ids=site_ids)

        reporter.set_step("transform")
        with logger.phase("transform") as phase:
            context = _read_context(fetch_plans)
            combined = pd.concat([context, raw], ignore_index=True) if not context.empty else raw
            transformed_all = transform_readings(combined)
            new_days_by_site = {
                site_id: {day for window in windows for day in _days_spanned(*window)}
                for site_id, windows in fetch_plans.items()
            }
            transformed = _keep_newly_fetched_days(transformed_all, new_days_by_site)
            phase.measure(transformed, site_ids=site_ids)
        reporter.finish_transform()

        reporter.set_step("load")
        with logger.phase("load") as phase:
            parquet_files = load_readings(transformed, on_file_written=reporter.tick_load)
            # les lignes soumises a l'ecriture, et le nombre de partitions reellement ecrites :
            # l'ecrivain fusionne avec l'existant, il ne rend pas un decompte de lignes
            phase.measure(transformed, site_ids=site_ids)
            phase.files(len(parquet_files))

    reporter.finish()
    return {"parquet_files": parquet_files}


def run_hour(
    now: datetime | None = None, verbose: bool = False, hours: int = 1
) -> dict[str, object]:
    now = now or datetime.now(timezone.utc)
    return run_periods(
        start_time=now - timedelta(hours=hours),
        end_time=now,
        verbose=verbose,
        skip_coverage_check=True,
        command="hour",
    )


def _read_context(fetch_plans: dict[str, list[tuple[datetime, datetime]]]) -> pd.DataFrame:
    frames = []
    for site_id, windows in fetch_plans.items():
        if not windows:
            continue
        earliest_new_day = min(window[0].date() for window in windows)
        # offset 0 inclus : le jour lui-meme peut deja porter des heures ecrites par un run
        # precedent (cron horaire), et servent alors de contexte a la nouvelle heure
        context_days = {
            earliest_new_day - timedelta(days=offset) for offset in range(0, CONTEXT_DAYS + 1)
        }
        site_context = get_context_days(site_id, context_days)
        if not site_context.empty:
            frames.append(site_context)

    if not frames:
        return pd.DataFrame()
    return pd.concat(frames, ignore_index=True)


def _days_spanned(start: datetime, end: datetime) -> set[date]:
    # une fenetre peut franchir minuit (cas de hour --hours 24) : ses deux jours sont extraits.
    # La borne de fin est exclue, une fenetre qui finit a minuit ne deborde pas sur le lendemain
    last_day = (end - timedelta(microseconds=1)).date()
    day = start.date()
    days = set()
    while day <= last_day:
        days.add(day)
        day += timedelta(days=1)
    return days


def _keep_newly_fetched_days(
    transformed: pd.DataFrame, new_days_by_site: dict[str, set[date]]
) -> pd.DataFrame:
    if transformed.empty:
        return transformed

    kept = [
        group[group["timestamp"].dt.date.isin(new_days_by_site.get(site_id, set()))]
        for site_id, group in transformed.groupby("site_id")
    ]
    return pd.concat(kept, ignore_index=True)


def _parse_datetime(value: str) -> datetime:
    parsed = datetime.fromisoformat(value)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed


def _positive_int(value: str) -> int:
    try:
        parsed = int(value)
    except ValueError as error:
        raise argparse.ArgumentTypeError(f"entier attendu, reçu {value!r}") from error
    if parsed < 1:
        raise argparse.ArgumentTypeError(f"au moins 1 attendu, reçu {parsed}")
    return parsed


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

    periods_parser = subparsers.add_parser(
        "periods", help="Extract, transform and load the readings history over a time period"
    )
    periods_parser.add_argument(
        "--start-time",
        type=_parse_datetime,
        default=None,
        help="Start of the period (ISO 8601, UTC if no offset given). Defaults to 7 days "
        "before --end-time, or 7 days before now if neither bound is given",
    )
    periods_parser.add_argument(
        "--end-time",
        type=_parse_datetime,
        default=None,
        help="End of the period (ISO 8601, UTC if no offset given). Defaults to 7 days "
        "after --start-time, or now if neither bound is given",
    )
    periods_parser.add_argument(
        "--verbose",
        action="store_true",
        help="Show a live progress display on stderr (current step, percentage, "
        "elapsed/remaining time). The JSON run journal goes to stdout either way",
    )

    hour_parser = subparsers.add_parser(
        "hour",
        help="Extract, transform and load the readings history for the last hours up to "
        "now (suited for an hourly cron, keeps the datalake current for the predictive "
        "model)",
    )
    hour_parser.add_argument(
        "--hours",
        type=_positive_int,
        default=1,
        help="Number of hours to refetch up to now (default: 1). A wider window fills "
        "any gap left by a missed run, the writer deduplicates on timestamp",
    )
    hour_parser.add_argument(
        "--verbose",
        action="store_true",
        help="Show a live progress display on stderr (current step, percentage, "
        "elapsed/remaining time). The JSON run journal goes to stdout either way",
    )

    return parser


def main() -> None:
    load_root_env()
    args = build_parser().parse_args()

    # les phrases pour l'humain sortent sur stderr : stdout ne porte que le journal JSON, sinon
    # une redirection vers un fichier melange les deux et jq s'arrete a la premiere phrase
    if args.command == "sites":
        result = run_sites(sync_db=args.sync_db)
        print(f"Sites reference data written to {result['parquet_file']}", file=sys.stderr)
        if args.sync_db:
            print(f"{result['db_inserted']} new site(s) added to PostgreSQL", file=sys.stderr)
    elif args.command == "periods":
        result = run_periods(
            start_time=args.start_time, end_time=args.end_time, verbose=args.verbose
        )
        if args.verbose:
            print(
                f"{len(result['parquet_files'])} Parquet file(s) written for the readings history",
                file=sys.stderr,
            )
    elif args.command == "hour":
        result = run_hour(hours=args.hours, verbose=args.verbose)
        if args.verbose:
            print(
                f"{len(result['parquet_files'])} Parquet file(s) written for the readings history",
                file=sys.stderr,
            )


if __name__ == "__main__":
    main()
