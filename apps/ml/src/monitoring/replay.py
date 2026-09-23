import pandas as pd

from features import MINIMUM_HISTORY_HOURS, SiteSchedules
from models.prediction import PredictionModel, PredictionService, PredictionTarget

# Matches the MVP acceptance criterion measured in notebooks/model_selection.ipynb:
# a relative error (MAE / mean consumption) below 20 % on the test window.
REPLAY_WINDOW_DAYS = 7
REPLAY_HORIZON_HOURS = 24
REPLAY_STEP_HOURS = 6

# History a caller must fetch to cover the whole replay window: the window
# itself, the 168 h a prediction needs before its earliest origin, and the
# horizon after its latest one.
REPLAY_HISTORY_HOURS = REPLAY_WINDOW_DAYS * 24 + MINIMUM_HISTORY_HOURS + REPLAY_HORIZON_HOURS


def compute_relative_mae_by_site(
    history: pd.DataFrame, model: PredictionModel, schedules: SiteSchedules
) -> dict[str, float]:
    """Replay the model on recent history and return MAE / mean(actual) per site.

    For each site, forecasts are replayed from several origins spread over the
    last REPLAY_WINDOW_DAYS days, each one predicting REPLAY_HORIZON_HOURS hours
    ahead exactly like a real /predictions call, except the target hours are
    already in the past: the true consumption is already known, so the error
    is available immediately instead of waiting for it to happen.
    """
    result: dict[str, float] = {}
    for site_id, site_history in history.groupby("site_id", sort=False):
        site_history = site_history.sort_values("timestamp").reset_index(drop=True)
        pairs = _replay_site(site_id, site_history, model, schedules)
        relative_mae = _relative_mae(pairs) if pairs else None
        if relative_mae is not None:
            result[site_id] = relative_mae
    return result


def _replay_site(
    site_id: str,
    site_history: pd.DataFrame,
    model: PredictionModel,
    schedules: SiteSchedules,
) -> list[tuple[float, float]]:
    actual_by_timestamp = site_history.set_index("timestamp")["consumption_kwh"]

    pairs: list[tuple[float, float]] = []
    for origin in _replay_origins(site_history):
        before = site_history[site_history["timestamp"] <= origin]
        targets = [
            PredictionTarget(site_id, timestamp.to_pydatetime())
            for timestamp in pd.date_range(
                start=origin + pd.Timedelta(hours=1),
                end=origin + pd.Timedelta(hours=REPLAY_HORIZON_HOURS),
                freq="h",
            )
        ]

        try:
            predictions = PredictionService(model, before, schedules).predict(targets)
        except ValueError:
            # Missing or non-consecutive hours before this origin: skip it
            # rather than let one bad window break the whole metric.
            continue

        for prediction in predictions:
            actual = actual_by_timestamp.get(pd.Timestamp(prediction.timestamp))
            if actual is None or pd.isna(actual):
                continue
            pairs.append((prediction.consumption_kwh, float(actual)))

    return pairs


def _replay_origins(site_history: pd.DataFrame) -> list[pd.Timestamp]:
    last_timestamp = pd.Timestamp(site_history["timestamp"].max())
    latest_origin = last_timestamp - pd.Timedelta(hours=REPLAY_HORIZON_HOURS)
    earliest_origin = last_timestamp - pd.Timedelta(days=REPLAY_WINDOW_DAYS)
    # Empty when the horizon does not fit before the window start; pandas
    # returns an empty range rather than raising when end precedes start.
    return list(pd.date_range(earliest_origin, latest_origin, freq=f"{REPLAY_STEP_HOURS}h"))


def _relative_mae(pairs: list[tuple[float, float]]) -> float | None:
    predicted, actual = zip(*pairs, strict=True)
    mean_actual = sum(actual) / len(actual)
    if mean_actual == 0:
        return None  # rien à rapporter à une moyenne nulle

    mae = sum(abs(p - a) for p, a in pairs) / len(pairs)
    return (mae / mean_actual) * 100
