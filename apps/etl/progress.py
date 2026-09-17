# affiche la progression de 'main.py periods --verbose' sur une seule ligne : étape, %, temps
# écoulé/restant
from __future__ import annotations

import time


def _format_duration(seconds: float) -> str:
    seconds = max(0, int(seconds))
    hours, remainder = divmod(seconds, 3600)
    minutes, seconds = divmod(remainder, 60)
    if hours:
        return f"{hours}h{minutes:02d}m{seconds:02d}s"
    if minutes:
        return f"{minutes}m{seconds:02d}s"
    return f"{seconds}s"


class ProgressReporter:
    # Poids fixe entre etapes : sur une longue periode, l'extraction (des centaines/milliers
    # d'appels HTTP site x jour) domine largement le temps reel, alors que le transform et le
    # load restent locaux et rapides en comparaison. La ponderation reste donc approximative
    # mais reflete cet ordre de grandeur plutot qu'un decoupage a parts egales.
    EXTRACT_WEIGHT = 0.90
    TRANSFORM_WEIGHT = 0.05
    LOAD_WEIGHT = 0.05

    def __init__(self, enabled: bool) -> None:
        self.enabled = enabled
        self.step = ""
        self.extract_total = 0
        self.extract_done = 0
        self.load_total = 0
        self.load_done = 0
        self.transform_done = False
        self._started_at: float | None = None

    def start(self) -> None:
        if not self.enabled:
            return
        self._started_at = time.monotonic()

    def set_extract_total(self, total: int) -> None:
        self.extract_total = total

    def set_load_total(self, total: int) -> None:
        self.load_total = total

    def set_step(self, step: str) -> None:
        self.step = step
        self._render()

    def tick_extract(self) -> None:
        self.extract_done += 1
        self._render()

    def finish_transform(self) -> None:
        self.transform_done = True
        self._render()

    def tick_load(self) -> None:
        self.load_done += 1
        self._render()

    def finish(self) -> None:
        if not self.enabled:
            return
        print()

    def _overall_fraction(self) -> float:
        extract_fraction = self.extract_done / self.extract_total if self.extract_total else 0.0
        transform_fraction = 1.0 if self.transform_done else 0.0
        load_fraction = self.load_done / self.load_total if self.load_total else 0.0
        return (
            extract_fraction * self.EXTRACT_WEIGHT
            + transform_fraction * self.TRANSFORM_WEIGHT
            + load_fraction * self.LOAD_WEIGHT
        )

    def _render(self) -> None:
        if not self.enabled:
            return

        overall = self._overall_fraction()
        elapsed = time.monotonic() - self._started_at

        sub_progress = ""
        if self.step == "extract" and self.extract_total:
            sub_progress = f" ({self.extract_done}/{self.extract_total})"
        elif self.step == "load" and self.load_total:
            sub_progress = f" ({self.load_done}/{self.load_total})"

        remaining_text = (
            _format_duration(elapsed * (1 - overall) / overall)
            if overall > 0
            else "estimation indisponible"
        )
        line = (
            f"[{self.step:<9}]{sub_progress} {overall:5.1%} au total "
            f"- ecoule {_format_duration(elapsed)} / restant {remaining_text}"
        )
        print(f"\r{line}".ljust(100), end="", flush=True)
