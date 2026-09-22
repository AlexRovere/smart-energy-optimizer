# teste le nettoyage des noms de colonnes du référentiel des sites, et son dédoublonnage
import pandas as pd

from transform.handler import clean_site_columns, dedupe_sites, transform_sites


def test_clean_site_columns_strips_the_site_prefix():
    sites = pd.DataFrame(
        [
            {
                "site_id": "SITE001",
                "site_type": "office",
                "site_name": "Bureau Paris La Défense",
                "location": "Paris, France",
                "capacity_kw": 200,
                "status": "active",
            }
        ]
    )

    result = clean_site_columns(sites)

    assert list(result.columns) == ["id", "type", "name", "location", "capacity_kw", "status"]


def test_transform_sites_cleans_column_names():
    sites = pd.DataFrame([{"site_id": "SITE001", "site_name": "Bureau Paris La Défense"}])

    result = transform_sites(sites)

    assert list(result.columns) == ["id", "name"]


def test_dedupe_sites_keeps_first_occurrence_per_id():
    sites = pd.DataFrame(
        [
            {"id": "SITE001", "name": "Bureau Paris La Défense"},
            {"id": "SITE001", "name": "Doublon a ignorer"},
            {"id": "SITE002", "name": "Usine Lyon Vénissieux"},
        ]
    )

    result = dedupe_sites(sites)

    assert list(result["id"]) == ["SITE001", "SITE002"]
    assert list(result["name"]) == ["Bureau Paris La Défense", "Usine Lyon Vénissieux"]
