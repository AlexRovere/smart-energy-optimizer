from collections import Counter
from datetime import UTC, datetime

from conftest import NOW, load_capture

from mock_api.catalog import SITES_BY_ID
from mock_api.generator import reading


def test_lecture_courante_porte_les_champs_de_l_api_reelle(client):
    response = client.get("/api/v1/sites/SITE001/current")

    assert response.status_code == 200
    assert list(response.json()) == list(load_capture("current-SITE001"))


def test_lecture_courante_horodatee_sans_fuseau_comme_l_api_reelle(client):
    body = client.get("/api/v1/sites/SITE001/current").json()

    assert body["timestamp"] == "2026-09-29T08:07:00.368439"


def test_lecture_courante_est_la_mesure_generee_pour_maintenant(client):
    body = client.get("/api/v1/sites/SITE001/current").json()
    del body["timestamp"]

    assert body == reading(SITES_BY_ID["SITE001"], NOW)


def test_lecture_courante_d_un_site_inconnu_renvoie_404(client):
    response = client.get("/api/v1/sites/SITE999/current")

    assert response.status_code == 404
    assert response.json() == load_capture("erreur-404-site")


def test_historique_repartit_limit_points_sur_la_fenetre_comme_l_api_reelle(client):
    capture = load_capture("readings-SITE001-48h")

    response = client.get(
        "/api/v1/readings",
        params={
            "site_id": "SITE001",
            "start_time": "2026-09-27T00:00:00",
            "end_time": "2026-09-29T00:00:00",
            "limit": 1000,
        },
    )

    body = response.json()
    assert response.status_code == 200
    assert len(body) == 1000
    assert [r["timestamp"] for r in body[: len(capture)]] == [r["timestamp"] for r in capture]
    assert list(body[0]) == list(capture[0])


def test_historique_horaire_quand_limit_vaut_le_nombre_d_heures(client):
    capture = load_capture("semaine-SITE001")

    body = client.get(
        "/api/v1/readings",
        params={
            "site_id": "SITE001",
            "start_time": "2026-09-22T00:00:00",
            "end_time": "2026-09-29T00:00:00",
            "limit": 168,
        },
    ).json()

    assert [r["timestamp"] for r in body] == [r["timestamp"] for r in capture]


def test_historique_accepte_les_dates_avec_decalage_envoyees_par_l_etl(client):
    body = client.get(
        "/api/v1/readings",
        params={
            "site_id": "SITE001",
            "start_time": "2026-09-22T00:00:00+00:00",
            "end_time": "2026-09-22T03:00:00+00:00",
            "limit": 3,
        },
    ).json()

    assert [r["timestamp"] for r in body] == [
        "2026-09-22T00:00:00Z",
        "2026-09-22T01:00:00Z",
        "2026-09-22T02:00:00Z",
    ]


def test_historique_rend_la_mesure_generee_pour_chaque_instant(client):
    body = client.get(
        "/api/v1/readings",
        params={
            "site_id": "SITE002",
            "start_time": "2026-09-22T10:00:00",
            "end_time": "2026-09-22T11:00:00",
            "limit": 1,
        },
    ).json()
    received = dict(body[0])
    del received["timestamp"]

    assert received == reading(SITES_BY_ID["SITE002"], datetime(2026, 9, 22, 10, tzinfo=UTC))


def test_historique_par_defaut_partage_limit_entre_tous_les_sites_sur_24h(client):
    capture = load_capture("readings-defaut")

    body = client.get("/api/v1/readings").json()

    assert Counter(r["site_id"] for r in body) == Counter(r["site_id"] for r in capture)
    assert body[0]["timestamp"] == "2026-09-28T08:07:00.368439Z"
    assert [r["site_id"] for r in body[:7]] == [f"SITE00{i}" for i in range(1, 8)]


def test_historique_d_un_site_inconnu_est_vide(client):
    response = client.get("/api/v1/readings", params={"site_id": "SITE999"})

    assert response.status_code == 200
    assert response.json() == []


def test_historique_refuse_une_limite_invalide_comme_l_api_reelle(client):
    capture = load_capture("erreur-422-readings")

    response = client.get("/api/v1/readings", params={"limit": "abc"})

    assert response.status_code == 422
    error = response.json()["detail"][0]
    expected = capture["detail"][0]
    assert {k: error[k] for k in ("type", "loc", "msg", "input")} == {
        k: expected[k] for k in ("type", "loc", "msg", "input")
    }


def test_historique_refuse_une_limite_au_dela_de_1000(client):
    response = client.get("/api/v1/readings", params={"limit": 1001})

    assert response.status_code == 422


def test_historique_de_tous_les_sites_vide_quand_limit_ne_suffit_pas_a_un_point_par_site(client):
    assert client.get("/api/v1/readings", params={"limit": 6}).json() == []
