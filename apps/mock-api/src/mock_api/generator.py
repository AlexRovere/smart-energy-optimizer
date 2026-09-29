"""Mesures simulées, déterministes : un site à un instant donné rend toujours la même mesure.

Le déterminisme n'est pas un confort de test. L'ETL relit des fenêtres qu'il a
déjà écrites et dédoublonne sur l'horodatage : une valeur qui changerait d'un
appel à l'autre réécrirait l'historique à chaque passage.

Les taux de panne sont ceux mesurés sur l'API réelle (1 176 lectures, semaine
du 22 au 28 septembre 2026). Une perte réseau vide tout et passe la mesure en
`critical` ; sinon chaque capteur tombe indépendamment, une panne donne
`partial` et plusieurs `degraded`.
"""

import math
import random
from datetime import datetime

from mock_api.catalog import Site

NETWORK_LOSS = "network_loss"

FAILURE_FIELDS: dict[str, tuple[str, ...]] = {
    "consumption_sensor_failure": ("consumption_kw", "consumption_kwh"),
    "electrical_sensor_failure": ("voltage_v", "current_a", "power_factor"),
    "temperature_sensor_failure": ("temperature_celsius",),
    "humidity_sensor_failure": ("humidity_percent",),
    NETWORK_LOSS: (
        "consumption_kw",
        "consumption_kwh",
        "voltage_v",
        "current_a",
        "power_factor",
        "temperature_celsius",
        "humidity_percent",
    ),
}

NETWORK_LOSS_RATE = 0.015
# Dans l'ordre où l'API réelle les énumère.
SENSOR_FAILURE_RATES: tuple[tuple[str, float], ...] = (
    ("consumption_sensor_failure", 0.046),
    ("electrical_sensor_failure", 0.034),
    ("temperature_sensor_failure", 0.077),
    ("humidity_sensor_failure", 0.064),
)


def _failures(rng: random.Random) -> list[str]:
    if rng.random() < NETWORK_LOSS_RATE:
        return [NETWORK_LOSS]
    return [reason for reason, rate in SENSOR_FAILURE_RATES if rng.random() < rate]


def _quality(reasons: list[str]) -> str:
    if NETWORK_LOSS in reasons:
        return "critical"
    if len(reasons) >= 2:
        return "degraded"
    if reasons:
        return "partial"
    return "good"


def _outdoor_temperature(moment: datetime, rng: random.Random) -> float:
    # Creux mi-janvier, pic mi-juillet, plus chaud l'après-midi que la nuit.
    day_of_year = moment.timetuple().tm_yday
    seasonal = 12.0 - 8.0 * math.cos(2 * math.pi * (day_of_year - 15) / 365)
    daily = 4.0 * math.sin(2 * math.pi * (moment.hour - 9) / 24)
    return seasonal + daily + rng.gauss(0, 1.5)


def reading(site: Site, moment: datetime) -> dict[str, object]:
    rng = random.Random(f"{site.site_id}|{moment.isoformat()}")

    profile = site.weekend_kw if moment.weekday() >= 5 else site.weekday_kw
    consumption = max(0.0, profile[moment.hour] + rng.gauss(0, site.noise_kw))
    voltage = rng.gauss(400.0, 3.0)
    power_factor = rng.uniform(0.85, 0.98)
    current = consumption * 1000 / (math.sqrt(3) * voltage * power_factor)
    temperature = _outdoor_temperature(moment, rng)
    humidity = min(90.0, max(20.0, rng.gauss(45.0, 8.0)))

    values: dict[str, float] = {
        "consumption_kw": round(consumption, 2),
        "consumption_kwh": round(consumption, 2),
        "voltage_v": round(voltage, 1),
        "current_a": round(current, 2),
        "power_factor": round(power_factor, 3),
        "temperature_celsius": round(temperature, 1),
        "humidity_percent": round(humidity, 1),
    }

    reasons = _failures(rng)
    for reason in reasons:
        for field in FAILURE_FIELDS[reason]:
            values[field] = None

    return {
        "site_id": site.site_id,
        "site_type": site.site_type,
        **values,
        "null_reasons": reasons,
        "data_quality": _quality(reasons),
    }
