from datetime import timedelta

from conftest import NOW, load_capture

from mock_api.catalog import SITES, SITES_BY_ID
from mock_api.generator import reading


def _current(site_id: str) -> dict[str, object]:
    return reading(SITES_BY_ID[site_id], NOW)


def test_racine_identique_a_l_api_reelle(client):
    assert client.get("/").json() == load_capture("root")


def test_sante_porte_les_champs_de_l_api_reelle(client):
    body = client.get("/health").json()

    assert body == {"status": "healthy", "timestamp": "2026-09-29T08:07:00.368439"}
    assert list(body) == list(load_capture("health"))


def test_synthese_porte_les_champs_de_l_api_reelle(client):
    capture = load_capture("stats-summary")

    body = client.get("/api/v1/stats/summary").json()

    assert list(body) == list(capture)
    assert list(body["sites"][0]) == list(capture["sites"][0])
    assert [s["site_id"] for s in body["sites"]] == [s["site_id"] for s in capture["sites"]]


def test_synthese_reprend_les_lectures_courantes(client):
    body = client.get("/api/v1/stats/summary").json()

    for entry in body["sites"]:
        current = _current(entry["site_id"])
        assert entry["current_consumption_kw"] == current["consumption_kw"]
        assert entry["data_quality"] == current["data_quality"]


def test_synthese_calcule_charges_et_totaux_comme_l_api_reelle(client):
    body = client.get("/api/v1/stats/summary").json()
    known = [s for s in body["sites"] if s["current_consumption_kw"] is not None]

    assert body["total_sites"] == 7
    assert body["total_capacity_kw"] == 4130
    assert all(isinstance(s["capacity_kw"], int) for s in body["sites"])
    assert body["total_consumption_kw"] == round(sum(s["current_consumption_kw"] for s in known), 2)
    assert body["average_load_percent"] == round(
        body["total_consumption_kw"] / body["total_capacity_kw"] * 100, 1
    )
    for entry in known:
        assert entry["load_percent"] == round(
            entry["current_consumption_kw"] / entry["capacity_kw"] * 100, 1
        )


def test_etat_des_capteurs_porte_les_champs_de_l_api_reelle(client):
    capture = load_capture("sensors-status")

    body = client.get("/api/v1/sensors/status").json()

    assert list(body) == list(capture)
    assert list(body["SITE001"]) == list(capture["SITE001"])
    assert list(body["SITE001"]["sensors"]) == list(capture["SITE001"]["sensors"])


def test_etat_des_capteurs_signale_les_pannes_de_la_lecture_courante(client):
    body = client.get("/api/v1/sensors/status").json()
    capteur_de = {
        "consumption_sensor_failure": "consumption",
        "electrical_sensor_failure": "electrical",
        "temperature_sensor_failure": "temperature",
        "humidity_sensor_failure": "humidity",
        "network_loss": "network",
    }

    for site in SITES:
        reasons = _current(site.site_id)["null_reasons"]
        failing = {capteur_de[r] for r in reasons}
        status = body[site.site_id]
        assert {
            name for name, s in status["sensors"].items() if s["status"] == "failing"
        } == failing
        assert status["overall"] == ("degraded" if failing else "ok")
        for name, sensor in status["sensors"].items():
            assert (sensor["failing_until"] is None) == (name not in failing)


def test_alertes_une_par_site_en_panne_ou_en_depassement(client):
    body = client.get("/api/v1/alerts").json()

    attendus = set()
    for site in SITES:
        current = _current(site.site_id)
        if current["null_reasons"]:
            attendus.add((site.site_id, "sensor"))
        kw = current["consumption_kw"]
        if kw is not None and kw > site.capacity_kw * 0.9:
            attendus.add((site.site_id, "consumption"))

    assert {(a["site_id"], a["type"]) for a in body} == attendus


def test_alertes_portent_les_champs_de_l_api_reelle(client):
    capture = load_capture("alerts")

    body = client.get("/api/v1/alerts").json()

    assert body, "l'instant figé doit produire au moins une alerte"
    for alerte in body:
        assert list(alerte) == list(capture[0])
        assert alerte["timestamp"] == "2026-09-29T08:07:00.368439"


def test_alertes_filtrees_par_site_et_par_severite(client):
    toutes = client.get("/api/v1/alerts").json()
    site_id = toutes[0]["site_id"]
    severity = toutes[0]["severity"]

    par_site = client.get("/api/v1/alerts", params={"site_id": site_id}).json()
    par_severite = client.get("/api/v1/alerts", params={"severity": severity}).json()

    assert par_site == [a for a in toutes if a["site_id"] == site_id]
    assert par_severite == [a for a in toutes if a["severity"] == severity]


def test_fin_de_panne_annoncee_dans_le_futur(client):
    body = client.get("/api/v1/sensors/status").json()
    fins = [
        s["failing_until"]
        for site in body.values()
        for s in site["sensors"].values()
        if s["failing_until"]
    ]

    assert all(fin > (NOW + timedelta(seconds=1)).strftime("%Y-%m-%dT%H:%M:%S.%f") for fin in fins)
