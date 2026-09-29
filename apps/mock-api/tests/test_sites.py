from conftest import load_capture


def test_liste_des_sites_identique_a_l_api_reelle(client):
    response = client.get("/api/v1/sites")

    assert response.status_code == 200
    assert response.json() == load_capture("sites")


def test_detail_d_un_site_identique_a_l_api_reelle(client):
    response = client.get("/api/v1/sites/SITE001")

    assert response.status_code == 200
    assert response.json() == load_capture("site-SITE001")


def test_site_inconnu_renvoie_le_404_de_l_api_reelle(client):
    response = client.get("/api/v1/sites/SITE999")

    assert response.status_code == 404
    assert response.json() == load_capture("erreur-404-site")
