# genere data.json (insights) depuis PARQUET_DIR : agregats journaliers/horaires, bornes, qualite,
# periodicite de la consommation et correlations entre metriques, par site
import json
import os
import time
from pathlib import Path

import pandas as pd
import pyarrow.compute as pc
import pyarrow.dataset as ds
from dotenv import load_dotenv
from kpis import build_kpis
from profiles import build_consumption_profiles

ENV_FILE = next(
    (parent / ".env" for parent in Path(__file__).resolve().parents if (parent / ".env").is_file()),
    None,
)
if ENV_FILE:
    load_dotenv(ENV_FILE, override=False)

PARQUET_DIR = os.getenv("PARQUET_DIR")
if not PARQUET_DIR:
    raise RuntimeError("PARQUET_DIR is not set")

OUTPUT_DIR = Path(__file__).resolve().parent

t0 = time.time()
# Liste explicite des .parquet : le répertoire peut contenir d'autres fichiers
# (export CSV, métadonnées Zone.Identifier de Windows...) que ds.dataset
# tenterait sinon de lire comme du Parquet.
parquet_files = sorted(str(p) for p in Path(PARQUET_DIR).rglob("*.parquet"))
if not parquet_files:
    raise RuntimeError(f"Aucun fichier .parquet dans {PARQUET_DIR}")
dataset = ds.dataset(
    parquet_files, format="parquet", partitioning="hive", partition_base_dir=PARQUET_DIR
)

METRICS = [
    ("consumption_kw_corrected", "Consommation (kW)"),
    ("voltage_v_corrected", "Tension (V)"),
    ("current_a_corrected", "Courant (A)"),
    ("power_factor_corrected", "Facteur de puissance"),
    ("temperature_celsius_corrected", "Température (°C)"),
    ("humidity_percent_corrected", "Humidité (%)"),
]
CHART_SITES = ["SITE001", "SITE003"]
ALL_SITES = [f"SITE00{n}" for n in range(1, 8)]

cols = (
    ["site_id", "timestamp", "site_type", "consumption_kwh_corrected"]
    + [m for m, _ in METRICS]
    + ["data_quality"]
)
site_filt = pc.field("site_id").isin(ALL_SITES)

current_schema_fragments = [
    frag
    for frag in dataset.get_fragments(filter=site_filt)
    if "consumption_kw_corrected" in frag.physical_schema.names
]
skipped = len(list(dataset.get_fragments(filter=site_filt))) - len(current_schema_fragments)
print(f"fragments retenus: {len(current_schema_fragments)}, ecartes (ancien format): {skipped}")

tables = [frag.to_table(columns=cols, filter=site_filt) for frag in current_schema_fragments]
df = pd.concat([t.to_pandas() for t in tables], ignore_index=True)
df["date"] = df["timestamp"].dt.date.astype(str)

HOURLY_LOOKBACK_DAYS = 10

daily = {}
hourly = {}
bounds = {}
quality = {}
for site in ALL_SITES:
    sdf = df[df["site_id"] == site]

    bounds[site] = {
        m: {
            "min": None if sdf[m].isna().all() else round(float(sdf[m].min()), 3),
            "max": None if sdf[m].isna().all() else round(float(sdf[m].max()), 3),
        }
        for m, _ in METRICS
    }

    if site not in CHART_SITES:
        continue

    grp = sdf.groupby("date")[[m for m, _ in METRICS]].mean().sort_index()
    daily[site] = {"dates": list(grp.index)}
    for m, _ in METRICS:
        daily[site][m] = [None if pd.isna(v) else round(float(v), 3) for v in grp[m]]
    quality[site] = sdf["data_quality"].value_counts().to_dict()

    recent = sdf.sort_values("timestamp")
    cutoff = recent["timestamp"].max() - pd.Timedelta(days=HOURLY_LOOKBACK_DAYS)
    recent = recent[recent["timestamp"] >= cutoff]
    hourly[site] = {"timestamps": [t.strftime("%Y-%m-%dT%H:%M:%SZ") for t in recent["timestamp"]]}
    for m, _ in METRICS:
        hourly[site][m] = [None if pd.isna(v) else round(float(v), 3) for v in recent[m]]

# Périodicité de la consommation : on compare x(t) à x(t - décalage) sur une grille horaire
# régulière (le décalage se fait sur le temps, pas sur les lignes, pour qu'une mesure
# manquante ne décale pas tout). Un rapport (écart type de la différence / écart type de la
# série) proche de 0 signifie que la série se répète à cette période, autour de racine de 2
# que le décalage n'apporte rien.
PERIODICITY_LAGS = [(24, "24 h"), (168, "7 j (168 h)"), (720, "30 j (720 h)")]
PERIODICITY_SUBSETS = [
    ("all", "Tous les jours"),
    ("weekday", "Hors week-end"),
    ("weekend", "Week-end seul"),
]
MIN_PAIRS = 30  # en dessous, le calcul n'est pas fiable : la cellule reste vide


def num(value, digits):
    return None if pd.isna(value) else round(float(value), digits)


def hourly_consumption(sdf):
    series = (
        sdf.drop_duplicates("timestamp")
        .set_index("timestamp")
        .sort_index()["consumption_kw_corrected"]
    )
    return series.reindex(pd.date_range(series.index.min(), series.index.max(), freq="h"))


def lag_stats(x, lag):
    """Statistiques de x(t) - x(t - lag) par type de jour, et la série des différences."""
    previous = x.shift(lag)
    diff = x - previous
    valid = diff.notna().to_numpy()
    # jours de la semaine en UTC, comme les timestamps du pipeline
    is_weekend = x.index.dayofweek >= 5
    previous_is_weekend = (x.index - pd.Timedelta(hours=lag)).dayofweek >= 5
    masks = {
        "all": valid,
        "weekday": valid & ~is_weekend & ~previous_is_weekend,
        "weekend": valid & is_weekend & previous_is_weekend,
    }
    stats = {}
    for name, mask in masks.items():
        if mask.sum() < MIN_PAIRS:
            stats[name] = None
            continue
        std_diff = diff[mask].std()
        std_x = x[mask].std()
        stats[name] = {
            "std_kw": num(std_diff, 3),
            "ratio": None if std_x == 0 else num(std_diff / std_x, 3),
            "rho": num(x[mask].corr(previous[mask]), 3),
            "n": int(mask.sum()),
        }
    return stats, diff


periodicity_stats = {}
periodicity_monthly = {}
for site in ALL_SITES:
    x = hourly_consumption(df[df["site_id"] == site])
    periodicity_stats[site] = {}
    for lag, _ in PERIODICITY_LAGS:
        stats, diff = lag_stats(x, lag)
        periodicity_stats[site][str(lag)] = stats
        if site in CHART_SITES:
            # écart type mensuel des différences : montre où le "presque" se creuse sur l'année
            # un mois n'est gardé qu'avec au moins 7 jours de couples : le premier mois d'un
            # décalage de 30 j n'en a presque pas et donnerait un point non représentatif
            by_month = diff.groupby(diff.index.strftime("%Y-%m")).agg(["std", "count"])
            monthly = by_month.loc[by_month["count"] >= 7 * 24, "std"].dropna()
            periodicity_monthly.setdefault(site, {})[str(lag)] = {
                "months": [f"{month}-01" for month in monthly.index],
                "std_kw": [round(float(v), 3) for v in monthly],
            }

# Corrélation de Pearson entre les métriques, sur les mesures horaires corrigées
metric_keys = [m for m, _ in METRICS]
correlation = {}
for site in CHART_SITES:
    corr = df.loc[df["site_id"] == site, metric_keys].corr()
    correlation[site] = {
        "keys": metric_keys,
        "matrix": [[num(corr.loc[a, b], 3) for b in metric_keys] for a in metric_keys],
    }

out = {
    "metrics": METRICS,
    "sites": CHART_SITES,
    "bounds_sites": ALL_SITES,
    "site_types": df.groupby("site_id")["site_type"].first().to_dict(),
    "daily": daily,
    "hourly": hourly,
    "bounds": bounds,
    "quality": quality,
    "periodicity": {
        "lags": [{"hours": h, "label": label} for h, label in PERIODICITY_LAGS],
        "subsets": [{"key": k, "label": label} for k, label in PERIODICITY_SUBSETS],
        "stats": periodicity_stats,
        "monthly": periodicity_monthly,
    },
    "correlation": correlation,
    "row_counts": {s: int((df["site_id"] == s).sum()) for s in CHART_SITES},
    "date_range": {s: [daily[s]["dates"][0], daily[s]["dates"][-1]] for s in CHART_SITES},
}

out_path = OUTPUT_DIR / "data.json"
with open(out_path, "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False)

profiles_path = OUTPUT_DIR / "profiles_data.json"
with open(profiles_path, "w", encoding="utf-8") as f:
    json.dump(build_consumption_profiles(df), f, ensure_ascii=False)

kpi_path = OUTPUT_DIR / "kpi_data.json"
with open(kpi_path, "w", encoding="utf-8") as f:
    json.dump(build_kpis(df), f, ensure_ascii=False)

print("done in", time.time() - t0, "s")
print("daily points per site:", len(daily["SITE001"]["dates"]), len(daily["SITE003"]["dates"]))
print("bornes calculees pour", len(bounds), "sites")
print(
    "periodicite calculee pour",
    len(periodicity_stats),
    "sites,",
    len(PERIODICITY_LAGS),
    "decalages",
)
print("correlations calculees pour", len(correlation), "sites")
print("profils par type de site ecrits dans", profiles_path)
print("KPI ecrits dans", kpi_path)
