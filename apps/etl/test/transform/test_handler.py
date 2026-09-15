# teste le passe-plat de transformation du référentiel des sites, et son dédoublonnage
import pandas as pd

from transform.handler import dedupe_sites, transform_sites


def test_transform_sites_returns_input_unchanged():
    sites = pd.DataFrame([{"site_id": "SITE001", "site_name": "Bureau Paris La Défense"}])

    result = transform_sites(sites)

    pd.testing.assert_frame_equal(result, sites)


def test_dedupe_sites_keeps_first_occurrence_per_site_id():
    sites = pd.DataFrame(
        [
            {"site_id": "SITE001", "site_name": "Bureau Paris La Défense"},
            {"site_id": "SITE001", "site_name": "Doublon a ignorer"},
            {"site_id": "SITE002", "site_name": "Usine Lyon Vénissieux"},
        ]
    )

    result = dedupe_sites(sites)

    assert list(result["site_id"]) == ["SITE001", "SITE002"]
    assert list(result["site_name"]) == ["Bureau Paris La Défense", "Usine Lyon Vénissieux"]
