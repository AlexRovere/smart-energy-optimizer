# émet le journal d'exécution de l'ETL : une ligne JSON par phase sur la sortie standard,
# jamais dans un fichier écrit d'ici (la redirection est le métier de l'enveloppe, #47)
from __future__ import annotations

import json
import sys
import time
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import TextIO

import pandas as pd

# ordre d'apparition des champs facultatifs, pour que deux lignes de meme phase se comparent
# a l'oeil dans un fichier de journal
OPTIONAL_FIELDS = ("rows", "rows_by_site", "period", "period_requested", "files", "error")


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _as_iso(moment: datetime) -> str:
    return moment.strftime("%Y-%m-%dT%H:%M:%SZ")


def _describe(failure: BaseException) -> dict[str, str]:
    # type et message suffisent dans la ligne : le traceback complet part sur stderr, ou il ne
    # pollue pas un journal destine a etre relu par jq
    return {"type": type(failure).__name__, "message": str(failure)}


def _covered_period(frame: pd.DataFrame) -> list[str] | None:
    if frame.empty or "timestamp" not in frame.columns:
        return None
    # l'extraction rend des chaines telles que l'API les envoie, le transform des datetime
    # deja typees
    moments = (
        frame["timestamp"]
        if pd.api.types.is_datetime64_any_dtype(frame["timestamp"])
        else pd.to_datetime(frame["timestamp"], utc=True, format="ISO8601")
    )
    return [_as_iso(moments.min()), _as_iso(moments.max())]


class PhaseLog:
    # accumule ce que la phase a appris ; rien n'est emis avant sa sortie
    def __init__(self) -> None:
        self.fields: dict[str, object] = {}

    def rows(self, count: int) -> None:
        self.fields["rows"] = int(count)

    def measure(self, frame: pd.DataFrame, site_ids: list[str]) -> None:
        # les zeros viennent de la liste des sites et non du DataFrame : un site muet doit
        # apparaitre a 0 plutot que disparaitre, c'est tout l'interet du detail par site
        counts = dict.fromkeys(site_ids, 0)
        if not frame.empty:
            observed = frame.groupby("site_id").size()
            counts.update({str(site_id): int(size) for site_id, size in observed.items()})
        self.fields["rows"] = len(frame)
        self.fields["rows_by_site"] = counts

        period = _covered_period(frame)
        if period is not None:
            self.fields["period"] = period

    def requested(self, start: datetime, end: datetime) -> None:
        self.fields["period_requested"] = [_as_iso(start), _as_iso(end)]

    def files(self, count: int) -> None:
        self.fields["files"] = int(count)


class RunLogger:
    def __init__(self, command: str, stream: TextIO | None = None) -> None:
        self.command = command
        self.stream = stream if stream is not None else sys.stdout
        self.run_id = _as_iso(_now())
        self._started_at = time.monotonic()
        self._last_rows: int | None = None

    def __enter__(self) -> RunLogger:
        return self

    def __exit__(self, exc_type: object, exc: BaseException | None, traceback: object) -> bool:
        summary: dict[str, object] = {}
        if self._last_rows is not None:
            summary["rows"] = self._last_rows
        if exc is not None:
            summary["error"] = _describe(exc)
        status = "ok" if exc is None else "error"
        self._emit("run", status, time.monotonic() - self._started_at, summary)
        return False

    @contextmanager
    def phase(self, name: str):
        phase_log = PhaseLog()
        started_at = time.monotonic()
        try:
            yield phase_log
        except BaseException as failure:
            phase_log.fields["error"] = _describe(failure)
            self._emit(name, "error", time.monotonic() - started_at, phase_log.fields)
            raise
        self._emit(name, "ok", time.monotonic() - started_at, phase_log.fields)

    def _emit(
        self, phase: str, status: str, duration: float, fields: dict[str, object] | None = None
    ) -> None:
        fields = fields or {}
        line: dict[str, object] = {
            "run": self.run_id,
            "command": self.command,
            "phase": phase,
            "status": status,
            "ts": _as_iso(_now()),
            "duration_s": round(duration, 3),
        }
        for key in OPTIONAL_FIELDS:
            if key in fields:
                line[key] = fields[key]

        rows = fields.get("rows")
        if isinstance(rows, int):
            self._last_rows = rows

        # echappement ASCII : la locale de la machine decide de l'encodage de stdout, et un
        # message d'erreur accentue partirait en cp1252 sous Windows, donc en JSON illisible.
        # flush a chaque ligne : stdout redirige vers un fichier est mis en tampon par blocs,
        # et un ETL tue brutalement perdrait justement les lignes qui precedent sa mort
        self.stream.write(json.dumps(line) + "\n")
        self.stream.flush()
