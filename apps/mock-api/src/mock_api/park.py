"""Vues d'ensemble du parc, toutes tirées de la lecture courante de chaque site.

Tirer alertes, état des capteurs et synthèse de la même lecture garde les
routes cohérentes entre elles, comme sur l'API réelle : un capteur en panne
dans /sensors/status est une valeur nulle dans /current au même instant.
"""

from datetime import datetime, timedelta

from mock_api.catalog import SITES, Site
from mock_api.generator import reading

# Seuil de dépassement : aucune valeur observée ne permet de le déduire de
# l'API réelle, 90 % de la capacité est un choix du simulateur.
CONSUMPTION_ALERT_RATIO = 0.9
FAILURE_DURATION = timedelta(minutes=15)

SENSOR_OF_REASON = {
    "consumption_sensor_failure": "consumption",
    "electrical_sensor_failure": "electrical",
    "temperature_sensor_failure": "temperature",
    "humidity_sensor_failure": "humidity",
    "network_loss": "network",
}
SENSORS = ("consumption", "electrical", "temperature", "humidity", "network")
SEVERITY_OF_QUALITY = {"partial": "low", "degraded": "medium", "critical": "high"}


def format_now(moment: datetime) -> str:
    return moment.strftime("%Y-%m-%dT%H:%M:%S.%f")


def summary(moment: datetime) -> dict[str, object]:
    entries = []
    for site in SITES:
        current = reading(site, moment)
        kw = current["consumption_kw"]
        capacity = int(site.capacity_kw)
        entries.append(
            {
                "site_id": site.site_id,
                "site_name": site.site_name,
                "current_consumption_kw": kw,
                "capacity_kw": capacity,
                "load_percent": None if kw is None else round(kw / capacity * 100, 1),
                "data_quality": current["data_quality"],
            }
        )

    total_kw = round(sum(e["current_consumption_kw"] or 0 for e in entries), 2)
    total_capacity = sum(e["capacity_kw"] for e in entries)
    return {
        "timestamp": format_now(moment),
        "total_sites": len(entries),
        "total_consumption_kw": total_kw,
        "total_capacity_kw": total_capacity,
        "average_load_percent": round(total_kw / total_capacity * 100, 1),
        "sites": entries,
    }


def sensors_status(moment: datetime) -> dict[str, object]:
    until = format_now(moment + FAILURE_DURATION)
    status = {}
    for site in SITES:
        failing = {SENSOR_OF_REASON[r] for r in reading(site, moment)["null_reasons"]}
        status[site.site_id] = {
            "site_name": site.site_name,
            "sensors": {
                name: {
                    "status": "failing" if name in failing else "ok",
                    "failing_until": until if name in failing else None,
                }
                for name in SENSORS
            },
            "overall": "degraded" if failing else "ok",
        }
    return status


def _alert(site: Site, moment: datetime, kind: str, severity: str, message: str, value) -> dict:
    return {
        "alert_id": f"ALR-{site.site_id}-{int(moment.timestamp())}",
        "timestamp": format_now(moment),
        "site_id": site.site_id,
        "severity": severity,
        "type": kind,
        "message": message,
        "value": value,
        "threshold": round(site.capacity_kw * CONSUMPTION_ALERT_RATIO, 1),
    }


def alerts(moment: datetime) -> list[dict[str, object]]:
    found = []
    for site in SITES:
        current = reading(site, moment)
        kw = current["consumption_kw"]
        if current["null_reasons"]:
            found.append(
                _alert(
                    site,
                    moment,
                    "sensor",
                    SEVERITY_OF_QUALITY[current["data_quality"]],
                    f"Défaillance capteur détectée sur {site.site_name}",
                    kw,
                )
            )
        if kw is not None and kw > site.capacity_kw * CONSUMPTION_ALERT_RATIO:
            found.append(
                _alert(
                    site,
                    moment,
                    "consumption",
                    "high",
                    f"Consommation élevée sur {site.site_name}",
                    kw,
                )
            )
    return found
