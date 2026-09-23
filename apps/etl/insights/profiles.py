from __future__ import annotations

import math

import pandas as pd

WEEKDAY_LABELS = [
    "Lundi",
    "Mardi",
    "Mercredi",
    "Jeudi",
    "Vendredi",
    "Samedi",
    "Dimanche",
]
PEAK_THRESHOLDS_PERCENT = [50, 60, 70, 80, 90, 100]


def _number(value: object, digits: int = 3) -> float | None:
    return None if pd.isna(value) else round(float(value), digits)


def _balanced_profile(
    frame: pd.DataFrame, dimensions: list[str]
) -> dict[str, list[dict[str, object]]]:
    valid = frame.dropna(subset=["site_type", "site_id", "consumption_kwh_corrected"])
    by_site = (
        valid.groupby(["site_type", "site_id", *dimensions], observed=True)
        .agg(mean_kwh=("consumption_kwh_corrected", "mean"), samples=("site_id", "size"))
        .reset_index()
    )
    by_type = (
        by_site.groupby(["site_type", *dimensions], observed=True)
        .agg(
            mean_kwh=("mean_kwh", "mean"),
            samples=("samples", "sum"),
            sites=("site_id", "nunique"),
        )
        .reset_index()
    )

    result: dict[str, list[dict[str, object]]] = {}
    for site_type, group in by_type.groupby("site_type", observed=True):
        rows = []
        for record in group.to_dict("records"):
            row = {dimension: int(record[dimension]) for dimension in dimensions}
            row.update(
                mean_kwh=_number(record["mean_kwh"]),
                samples=int(record["samples"]),
                sites=int(record["sites"]),
            )
            rows.append(row)
        result[str(site_type)] = rows
    return result


def _environment_profile(
    frame: pd.DataFrame, column: str, width: int
) -> dict[str, list[dict[str, object]]]:
    valid = frame.dropna(subset=[column, "consumption_kwh_corrected"]).copy()
    valid["bin_start"] = (valid[column] / width).apply(math.floor).astype(int) * width
    profile = _balanced_profile(valid, ["bin_start"])
    for rows in profile.values():
        for row in rows:
            start = int(row["bin_start"])
            row["bin_end"] = start + width
            row["label"] = f"{start}–{start + width}"
    return profile


def _correlation(group: pd.DataFrame, column: str) -> float | None:
    valid = group[[column, "consumption_kwh_corrected"]].dropna()
    if len(valid) < 2 or valid[column].nunique() < 2:
        return None
    return _number(valid[column].corr(valid["consumption_kwh_corrected"]))


def _relationship_sentence(label: str, correlation: float | None) -> str:
    if correlation is None:
        return f"Le lien avec {label} n'est pas calculable sur les données disponibles."
    strength = abs(correlation)
    if strength < 0.2:
        return f"Aucune association linéaire nette avec {label} n'apparaît (r={correlation:.2f})."
    level = "modérée" if strength < 0.5 else "forte"
    direction = "augmente" if correlation > 0 else "diminue"
    return (
        f"La consommation {direction} globalement lorsque {label} augmente, avec une "
        f"association {level} (r={correlation:.2f})."
    )


def _summary(frame: pd.DataFrame, weekday_hour: dict[str, list[dict[str, object]]]) -> dict:
    summaries = {}
    for site_type, group in frame.groupby("site_type", observed=True):
        type_name = str(site_type)
        cells = weekday_hour.get(type_name, [])
        peak = max(cells, key=lambda cell: cell["mean_kwh"]) if cells else None

        per_site_period = (
            group.dropna(subset=["consumption_kwh_corrected"])
            .assign(
                period=lambda data: (
                    data["day_of_week"].ge(5).map({True: "weekend", False: "weekday"})
                )
            )
            .groupby(["site_id", "period"])["consumption_kwh_corrected"]
            .mean()
            .unstack()
        )
        weekday_mean = per_site_period.get("weekday", pd.Series(dtype=float)).mean()
        weekend_mean = per_site_period.get("weekend", pd.Series(dtype=float)).mean()
        weekend_change = (
            None
            if pd.isna(weekday_mean) or weekday_mean == 0 or pd.isna(weekend_mean)
            else _number((weekend_mean / weekday_mean - 1) * 100, 1)
        )
        temperature_r = _correlation(group, "temperature_celsius_corrected")
        humidity_r = _correlation(group, "humidity_percent_corrected")

        if peak:
            peak_text = (
                f"le niveau moyen maximal est observé le "
                f"{WEEKDAY_LABELS[int(peak['day_of_week'])].lower()} à "
                f"{int(peak['hour']):02d} h ({peak['mean_kwh']:.2f} kWh)."
            )
        else:
            peak_text = "aucun créneau de pointe ne peut être identifié."

        if weekend_change is None:
            weekend_text = "La comparaison entre semaine et week-end n'est pas disponible."
        elif weekend_change < 0:
            weekend_text = (
                f"Le week-end est en moyenne inférieur de {abs(weekend_change):.1f} % "
                "aux jours ouvrés."
            )
        else:
            weekend_text = (
                f"Le week-end est en moyenne supérieur de {weekend_change:.1f} % aux jours ouvrés."
            )

        conclusion = " ".join(
            [
                f"Pour les sites de type « {type_name} », {peak_text}",
                weekend_text,
                _relationship_sentence("la température", temperature_r),
                _relationship_sentence("l'humidité", humidity_r),
                "Ces relations sont descriptives et ne démontrent pas un lien de causalité.",
            ]
        )
        summaries[type_name] = {
            "sites": int(group["site_id"].nunique()),
            "samples": int(group["consumption_kwh_corrected"].notna().sum()),
            "mean_kwh": _number(
                group.groupby("site_id")["consumption_kwh_corrected"].mean().mean()
            ),
            "weekend_change_percent": weekend_change,
            "temperature_correlation": temperature_r,
            "humidity_correlation": humidity_r,
            "conclusion": conclusion,
        }
    return summaries


def _peak_analysis(frame: pd.DataFrame) -> dict[str, list[dict[str, object]]]:
    result: dict[str, list[dict[str, object]]] = {}
    valid = frame.dropna(subset=["site_id", "site_type", "consumption_kwh_corrected"])
    for site_id, group in valid.groupby("site_id", observed=True):
        site_type = str(group["site_type"].iloc[0])
        consumption = group["consumption_kwh_corrected"]
        mean_kwh = float(consumption.mean())
        thresholds = {}
        for percent in PEAK_THRESHOLDS_PERCENT:
            threshold_kwh = mean_kwh * (1 + percent / 100)
            peak_rows = group[consumption > threshold_kwh]
            peak_values = peak_rows["consumption_kwh_corrected"]
            count = len(peak_rows)
            thresholds[str(percent)] = {
                "threshold_kwh": _number(threshold_kwh),
                "count": count,
                "rate_percent": _number(count / len(group) * 100, 2),
                "maximum_kwh": _number(peak_values.max()),
                "average_excess_kwh": _number((peak_values - threshold_kwh).mean()),
                "peak_hour": int(peak_rows["hour"].mode().iloc[0]) if count else None,
                "peak_day_of_week": (
                    int(peak_rows["day_of_week"].mode().iloc[0]) if count else None
                ),
            }
        result.setdefault(site_type, []).append(
            {
                "site_id": str(site_id),
                "mean_kwh": _number(mean_kwh),
                "samples": len(group),
                "thresholds": thresholds,
            }
        )

    for sites in result.values():
        sites.sort(key=lambda site: site["site_id"])
    return result


def _site_monthly_profile(frame: pd.DataFrame) -> list[dict[str, object]]:
    valid = frame.dropna(subset=["site_id", "site_type", "consumption_kwh_corrected"])
    grouped = (
        valid.groupby(["site_id", "site_type", "month"], observed=True)
        .agg(mean_kwh=("consumption_kwh_corrected", "mean"), samples=("site_id", "size"))
        .reset_index()
        .sort_values(["site_id", "month"])
    )
    return [
        {
            "site_id": str(row["site_id"]),
            "site_type": str(row["site_type"]),
            "month": int(row["month"]),
            "mean_kwh": _number(row["mean_kwh"]),
            "samples": int(row["samples"]),
        }
        for row in grouped.to_dict("records")
    ]


def build_consumption_profiles(frame: pd.DataFrame) -> dict[str, object]:
    required = {
        "site_id",
        "site_type",
        "timestamp",
        "consumption_kwh_corrected",
        "temperature_celsius_corrected",
        "humidity_percent_corrected",
    }
    missing = sorted(required - set(frame.columns))
    if missing:
        raise ValueError(f"Colonnes manquantes pour les profils: {', '.join(missing)}")

    data = frame[list(required)].copy()
    data["timestamp"] = pd.to_datetime(data["timestamp"], utc=True)
    data["hour"] = data["timestamp"].dt.hour
    data["day_of_week"] = data["timestamp"].dt.dayofweek
    data["month"] = data["timestamp"].dt.month

    weekday_hour = _balanced_profile(data, ["day_of_week", "hour"])
    return {
        "unit": "kWh",
        "method": (
            "Moyenne calculée d'abord par site, puis entre les sites d'un même type. "
            "Les timestamps et jours sont interprétés en UTC."
        ),
        "types": sorted(str(value) for value in data["site_type"].dropna().unique()),
        "weekday_labels": WEEKDAY_LABELS,
        "weekday_hour": weekday_hour,
        "monthly": _balanced_profile(data, ["month"]),
        "site_monthly": _site_monthly_profile(data),
        "temperature": _environment_profile(data, "temperature_celsius_corrected", 5),
        "humidity": _environment_profile(data, "humidity_percent_corrected", 10),
        "peak_thresholds_percent": PEAK_THRESHOLDS_PERCENT,
        "peaks": _peak_analysis(data),
        "summaries": _summary(data, weekday_hour),
    }
