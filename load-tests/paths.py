# chemins fixes des scripts de charge, jamais reçus en argument (rapports, historique Parquet)
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
REPORTS_DIR = REPO_ROOT / "rapport-qualite"
LOADTEST_PARQUET_DIR = REPO_ROOT / "data" / "loadtest-parquet"
