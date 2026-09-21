# genere data.json (insights) depuis PARQUET_DIR : agregats journaliers/horaires, bornes et qualite par site
import json
import os
import time
from pathlib import Path

import pandas as pd
import pyarrow.compute as pc
import pyarrow.dataset as ds
from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parents[4]
load_dotenv(REPO_ROOT / ".env", override=False)

PARQUET_DIR = os.getenv("PARQUET_DIR")
if not PARQUET_DIR:
    raise RuntimeError("PARQUET_DIR is not set")

OUTPUT_DIR = Path(__file__).resolve().parent

t0 = time.time()
dataset = ds.dataset(PARQUET_DIR, format="parquet", partitioning="hive")

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

cols = ["site_id", "timestamp"] + [m for m, _ in METRICS] + ["data_quality"]
site_filt = pc.field("site_id").isin(ALL_SITES)

current_schema_fragments = [
    frag for frag in dataset.get_fragments(filter=site_filt)
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

out = {
    "metrics": METRICS,
    "sites": CHART_SITES,
    "bounds_sites": ALL_SITES,
    "daily": daily,
    "hourly": hourly,
    "bounds": bounds,
    "quality": quality,
    "row_counts": {s: int((df["site_id"] == s).sum()) for s in CHART_SITES},
    "date_range": {s: [daily[s]["dates"][0], daily[s]["dates"][-1]] for s in CHART_SITES},
}

out_path = OUTPUT_DIR / "data.json"
with open(out_path, "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False)

print("done in", time.time() - t0, "s")
print("daily points per site:", len(daily["SITE001"]["dates"]), len(daily["SITE003"]["dates"]))
print("bornes calculees pour", len(bounds), "sites")
