# teste les scripts notebooks/insights/{prepare_data,build_html}.py : génération et
# cohérence des calculs de périodicité et de corrélation, sur de faux Parquet créés en
# tmp_path (aucun Parquet réel n'est commité). Les scripts s'exécutent en sous-processus,
# comme en usage réel, avec PARQUET_DIR et INSIGHTS_OUTPUT_DIR pointés sur des dossiers
# jetables.
import json
import subprocess
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq
import pytest

INSIGHTS_DIR = Path(__file__).resolve().parents[1] / "notebooks" / "insights"
PREPARE_SCRIPT = INSIGHTS_DIR / "prepare_data.py"
BUILD_SCRIPT = INSIGHTS_DIR / "build_html.py"

ALL_SITES = [f"SITE00{n}" for n in range(1, 8)]
HOURS = 2400  # 100 jours : assez de semaines pour que l'autocorrélation soit stable


def run_script(script: Path, parquet_dir: Path, output_dir: Path) -> subprocess.CompletedProcess:
    env = {
        **__import__("os").environ,
        "PARQUET_DIR": str(parquet_dir),
        "INSIGHTS_OUTPUT_DIR": str(output_dir),
    }
    return subprocess.run(
        [sys.executable, str(script)], env=env, capture_output=True, text=True, check=False
    )


def periodic_signal(hours: int, weekend_noise: bool = False) -> np.ndarray:
    """Sinusoïde à 24 h, identique tous les jours. Si weekend_noise, un bruit fort est ajouté
    le week-end seulement (hypothèse à vérifier : périodique en semaine, pas le week-end)."""
    hour_of_day = np.arange(hours) % 24
    base = 10 + 5 * np.sin(2 * np.pi * hour_of_day / 24)
    if not weekend_noise:
        return base
    timestamps = pd.date_range("2024-01-01", periods=hours, freq="h", tz="UTC")
    is_weekend = timestamps.dayofweek >= 5
    rng = np.random.default_rng(42)
    return np.where(is_weekend, base + rng.normal(0, 8, hours), base)


def white_noise(hours: int, seed: int) -> np.ndarray:
    """Bruit blanc : aucune périodicité attendue, à aucun décalage."""
    rng = np.random.default_rng(seed)
    return 50 + rng.normal(0, 10, hours)


def site_frame(site_id: str, site_type: str, consumption: np.ndarray) -> pd.DataFrame:
    hours = len(consumption)
    timestamps = pd.date_range("2024-01-01", periods=hours, freq="h", tz="UTC")
    rng = np.random.default_rng(abs(hash(site_id)) % (2**32))
    noise = rng.normal(0, 1, hours)
    return pd.DataFrame(
        {
            "site_id": site_id,
            "site_type": site_type,
            "timestamp": timestamps,
            "consumption_kw_corrected": consumption,
            # relations connues, pour vérifier la matrice de corrélation :
            "current_a_corrected": 2 * consumption,  # corrélation exacte +1
            "voltage_v_corrected": 400 - consumption,  # corrélation exacte -1
            "power_factor_corrected": 0.9 + noise * 0.01,  # indépendant, corrélation ~0
            "temperature_celsius_corrected": 20 + noise,
            "humidity_percent_corrected": 50 + noise,
            "data_quality": "good",
        }
    )


def write_parquet(root: Path, frames: list[pd.DataFrame]) -> None:
    for frame in frames:
        site_id = frame["site_id"].iloc[0]
        partition = root / f"site_id={site_id}"
        partition.mkdir(parents=True, exist_ok=True)
        # site_id doit rester une colonne physique, comme dans les vrais fichiers écrits par
        # l'ETL (apps/etl/load/readings.py) : prepare_data.py lit chaque fragment par
        # to_table(columns=...), qui ignore les colonnes virtuelles de partition et ne
        # trouve que les colonnes réellement présentes dans le fichier.
        # Son type doit en revanche être forcé à pa.string() ("petit"), le même que celui
        # que pyarrow déduit du nom de dossier site_id=... : pandas choisit large_string
        # par défaut, et pyarrow refuse de fusionner les deux avec des types différents.
        table = pa.Table.from_pandas(frame, preserve_index=False)
        site_id_index = table.schema.get_field_index("site_id")
        table = table.set_column(
            site_id_index, "site_id", table.column("site_id").cast(pa.string())
        )
        pq.write_table(table, partition / "readings.parquet")


@pytest.fixture(scope="module")
def signal_parquet_dir(tmp_path_factory) -> Path:
    """7 sites aux comportements connus d'avance :
    - SITE001 (office) : périodique à 24 h en semaine, bruité le week-end (hypothèse
      "il faut enlever les week-ends sur les sites type office") ;
    - SITE003 (datacenter) : bruit blanc, aucune périodicité, à aucun décalage ;
    - les 5 autres : périodique à 24 h, sans particularité (juste pour ne pas planter
      le calcul des bornes/périodicité "tous sites", qui itère sur les 7).
    """
    root = tmp_path_factory.mktemp("parquet")
    frames = [
        site_frame("SITE001", "office", periodic_signal(HOURS, weekend_noise=True)),
        site_frame("SITE003", "datacenter", white_noise(HOURS, seed=3)),
        *(site_frame(f"SITE00{n}", "factory", periodic_signal(HOURS)) for n in (2, 4, 5, 6, 7)),
    ]
    write_parquet(root, frames)
    return root


@pytest.fixture(scope="module")
def insights_data(signal_parquet_dir: Path, tmp_path_factory) -> dict:
    """Lance prepare_data.py une seule fois sur le jeu de données ci-dessus, partagé par
    tous les tests de cohérence : générer 16 800 lignes à chaque test serait inutilement
    lent."""
    output_dir = tmp_path_factory.mktemp("output")
    result = run_script(PREPARE_SCRIPT, signal_parquet_dir, output_dir)
    assert result.returncode == 0, result.stderr
    with open(output_dir / "data.json", encoding="utf-8") as f:
        return json.load(f)


# --- génération -------------------------------------------------------------


def test_prepare_then_build_write_both_files(tmp_path):
    parquet_dir = tmp_path / "parquet"
    output_dir = tmp_path / "output"
    write_parquet(parquet_dir, [site_frame(s, "office", periodic_signal(200)) for s in ALL_SITES])

    prepared = run_script(PREPARE_SCRIPT, parquet_dir, output_dir)
    assert prepared.returncode == 0, prepared.stderr
    data_path = output_dir / "data.json"
    assert data_path.exists()

    built = run_script(BUILD_SCRIPT, parquet_dir, output_dir)
    assert built.returncode == 0, built.stderr
    html_path = output_dir / "apercu_sites_001_003.html"
    assert html_path.exists()

    # le HTML embarque exactement le JSON produit par prepare_data.py, verbatim
    assert data_path.read_text(encoding="utf-8") in html_path.read_text(encoding="utf-8")


def test_empty_parquet_dir_fails_clearly(tmp_path):
    parquet_dir = tmp_path / "parquet"
    parquet_dir.mkdir()
    output_dir = tmp_path / "output"

    result = run_script(PREPARE_SCRIPT, parquet_dir, output_dir)

    assert result.returncode != 0
    assert "Aucun fichier .parquet" in result.stderr
    assert not (output_dir / "data.json").exists()


def test_stray_files_in_parquet_dir_are_ignored(tmp_path):
    """Non-régression : un CSV et un fichier Zone.Identifier (métadonnée Windows) posés
    dans le dossier ne doivent pas faire planter la lecture."""
    parquet_dir = tmp_path / "parquet"
    output_dir = tmp_path / "output"
    write_parquet(parquet_dir, [site_frame(s, "office", periodic_signal(48)) for s in ALL_SITES])
    (parquet_dir / "all_sites_combined.csv").write_text("site_id,timestamp\n", encoding="utf-8")
    try:
        zone_identifier = next(parquet_dir.rglob("readings.parquet")).with_name(
            "readings.parquet:Zone.Identifier"
        )
        zone_identifier.write_text("[ZoneTransfer]\nZoneId=3\n", encoding="utf-8")
    except OSError:
        pass  # ':' interdit dans un nom de fichier sur ce système : le CSV suffit à tester

    result = run_script(PREPARE_SCRIPT, parquet_dir, output_dir)

    assert result.returncode == 0, result.stderr
    with open(output_dir / "data.json", encoding="utf-8") as f:
        data = json.load(f)
    assert data["row_counts"]["SITE001"] == 48


# --- cohérence : périodicité -------------------------------------------------


def test_periodicity_ratio_is_near_zero_for_a_purely_periodic_signal(insights_data):
    # SITE001 hors week-end est construit sans aucun bruit d'un jour à l'autre : le rapport
    # (écart type de la différence / écart type de la série) doit être quasi nul
    weekday = insights_data["periodicity"]["stats"]["SITE001"]["24"]["weekday"]
    assert weekday["ratio"] < 0.05
    assert weekday["rho"] > 0.99


def test_periodicity_ratio_is_worse_with_weekends_included(insights_data):
    # confirme l'hypothèse du collègue : sur SITE001, retirer les week-ends améliore
    # nettement le rapport, puisque le bruit n'a été injecté que le week-end
    stats = insights_data["periodicity"]["stats"]["SITE001"]["24"]
    assert stats["weekday"]["ratio"] < stats["all"]["ratio"]


def test_periodicity_ratio_is_near_sqrt2_for_white_noise(insights_data):
    # SITE003 est un bruit blanc : le décalage n'apprend rien, à aucun horizon
    for lag in ("24", "168", "720"):
        stats = insights_data["periodicity"]["stats"]["SITE003"][lag]["all"]
        assert 1.2 < stats["ratio"] < 1.6
        assert abs(stats["rho"]) < 0.2


def test_thirty_day_weekend_subset_is_always_empty(insights_data):
    # fait mathématique, pas une propriété du jeu de données : 720 h = 30 jours décale le
    # jour de la semaine de 2 jours (30 mod 7), donc t et t-720h ne tombent jamais tous les
    # deux un jour de week-end
    for site in ("SITE001", "SITE003"):
        assert insights_data["periodicity"]["stats"][site]["720"]["weekend"] is None


def test_periodicity_ratios_are_never_negative(insights_data):
    for site_stats in insights_data["periodicity"]["stats"].values():
        for lag_stats in site_stats.values():
            for subset_stats in lag_stats.values():
                if subset_stats is not None:
                    assert subset_stats["ratio"] >= 0


# --- cohérence : corrélations -------------------------------------------------


def test_correlation_matrix_matches_known_relationships(insights_data):
    corr = insights_data["correlation"]["SITE001"]
    keys = corr["keys"]
    matrix = corr["matrix"]

    def value(a, b):
        return matrix[keys.index(a)][keys.index(b)]

    # current = 2 * consumption (relation linéaire exacte, corrélation +1)
    assert value("consumption_kw_corrected", "current_a_corrected") > 0.999
    # voltage = 400 - consumption (relation linéaire exacte de pente négative, corrélation -1)
    assert value("consumption_kw_corrected", "voltage_v_corrected") < -0.999
    # power_factor est un bruit indépendant de la consommation
    assert abs(value("consumption_kw_corrected", "power_factor_corrected")) < 0.1


def test_correlation_matrix_is_symmetric_with_unit_diagonal(insights_data):
    for site in ("SITE001", "SITE003"):
        corr = insights_data["correlation"][site]
        matrix = corr["matrix"]
        n = len(corr["keys"])
        for i in range(n):
            assert matrix[i][i] == 1
            for j in range(n):
                assert matrix[i][j] == matrix[j][i]
                assert -1.0 <= matrix[i][j] <= 1.0


# --- cohérence : bornes et qualité -------------------------------------------------


def test_bounds_min_is_never_greater_than_max(insights_data):
    for site_bounds in insights_data["bounds"].values():
        for metric_bounds in site_bounds.values():
            if metric_bounds["min"] is not None:
                assert metric_bounds["min"] <= metric_bounds["max"]


def test_quality_counts_sum_to_row_count(insights_data):
    for site in insights_data["sites"]:
        total_quality = sum(insights_data["quality"][site].values())
        assert total_quality == insights_data["row_counts"][site]
