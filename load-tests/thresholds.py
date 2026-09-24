# seuils de 95e percentile (ms) par requête nommée, lus par check_thresholds.py
THRESHOLDS_MS = {
    "predictions_1h": 1_000.0,
    "predictions_24h": 3_000.0,
    "predictions_168h": 10_000.0,
    "training": 60_000.0,
    "dashboard_history": 2_000.0,
}
