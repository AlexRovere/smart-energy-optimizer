import statistics
from datetime import UTC, datetime, timedelta

from conftest import load_capture

from mock_api.catalog import SITES_BY_ID
from mock_api.generator import FAILURE_FIELDS, reading

SITE001 = SITES_BY_ID["SITE001"]
START = datetime(2026, 1, 5, tzinfo=UTC)  # un lundi
HOURS_OF_TWO_YEARS = [START + timedelta(hours=h) for h in range(2 * 365 * 24)]


def test_une_meme_heure_donne_toujours_la_meme_mesure():
    moment = datetime(2026, 9, 22, 10, tzinfo=UTC)

    assert reading(SITE001, moment) == reading(SITE001, moment)


def test_deux_heures_differentes_donnent_des_mesures_differentes():
    moment = datetime(2026, 9, 22, 10, tzinfo=UTC)

    assert reading(SITE001, moment) != reading(SITE001, moment + timedelta(hours=1))


def test_la_mesure_porte_les_champs_de_l_api_reelle_dans_le_meme_ordre():
    capture = load_capture("current-SITE001")
    generated = reading(SITE001, datetime(2026, 9, 22, 10, tzinfo=UTC))

    assert list(generated) == [key for key in capture if key != "timestamp"]


def test_la_consommation_suit_le_profil_de_semaine_et_de_week_end():
    def mean(hour: int, weekend: bool) -> float:
        values = [
            reading(SITE001, moment)["consumption_kw"]
            for moment in HOURS_OF_TWO_YEARS
            if moment.hour == hour and (moment.weekday() >= 5) == weekend
        ]
        return statistics.mean(v for v in values if v is not None)

    assert abs(mean(12, weekend=False) - SITE001.weekday_kw[12]) < 3
    assert abs(mean(3, weekend=False) - SITE001.weekday_kw[3]) < 3
    assert abs(mean(12, weekend=True) - SITE001.weekend_kw[12]) < 3


def test_l_energie_horaire_egale_la_puissance_moyenne():
    for moment in HOURS_OF_TWO_YEARS[:200]:
        generated = reading(SITE001, moment)
        assert generated["consumption_kwh"] == generated["consumption_kw"]


def test_les_pannes_suivent_les_taux_observes_sur_l_api_reelle():
    readings = [reading(SITE001, moment) for moment in HOURS_OF_TWO_YEARS]
    total = len(readings)

    def rate(reason: str) -> float:
        return sum(reason in r["null_reasons"] for r in readings) / total

    # Taux mesurés sur 1 176 lectures (7 sites, une semaine), à la louche.
    assert 0.06 < rate("temperature_sensor_failure") < 0.09
    assert 0.05 < rate("humidity_sensor_failure") < 0.08
    assert 0.035 < rate("consumption_sensor_failure") < 0.06
    assert 0.025 < rate("electrical_sensor_failure") < 0.045
    assert 0.01 < rate("network_loss") < 0.02


def test_chaque_panne_vide_exactement_ses_champs():
    for moment in HOURS_OF_TWO_YEARS[:3000]:
        generated = reading(SITE001, moment)
        expected_nulls = {
            field for reason in generated["null_reasons"] for field in FAILURE_FIELDS[reason]
        }
        actual_nulls = {key for key, value in generated.items() if value is None}
        assert actual_nulls == expected_nulls


def test_la_qualite_decoule_des_pannes_comme_sur_l_api_reelle():
    for moment in HOURS_OF_TWO_YEARS[:3000]:
        generated = reading(SITE001, moment)
        reasons = generated["null_reasons"]
        if "network_loss" in reasons:
            expected = "critical"
        elif len(reasons) >= 2:
            expected = "degraded"
        elif reasons:
            expected = "partial"
        else:
            expected = "good"
        assert generated["data_quality"] == expected


def test_une_perte_reseau_est_la_seule_raison_affichee():
    losses = [
        reading(SITE001, moment)
        for moment in HOURS_OF_TWO_YEARS
        if "network_loss" in reading(SITE001, moment)["null_reasons"]
    ]

    assert losses
    assert all(p["null_reasons"] == ["network_loss"] for p in losses)


def test_les_grandeurs_electriques_restent_dans_les_plages_observees():
    for moment in HOURS_OF_TWO_YEARS[:3000]:
        generated = reading(SITE001, moment)
        if generated["voltage_v"] is not None:
            assert 385 < generated["voltage_v"] < 415
            assert 0.8 < generated["power_factor"] <= 1.0
            assert generated["current_a"] > 0
        if generated["humidity_percent"] is not None:
            assert 0 <= generated["humidity_percent"] <= 100
