# teste l'autorité TLS des utilisateurs Locust sans importer Locust (gevent figerait les tests)
from locustfiles._tls import tls_verify


def test_the_given_ca_bundle_is_used_to_verify_the_dashboard_certificate(monkeypatch):
    monkeypatch.setenv("LOAD_TEST_CA_BUNDLE", "/tmp/caddy-root.crt")

    assert tls_verify() == "/tmp/caddy-root.crt"


def test_without_ca_bundle_the_default_verification_is_kept(monkeypatch):
    monkeypatch.delenv("LOAD_TEST_CA_BUNDLE", raising=False)

    assert tls_verify() is True


def test_an_empty_ca_bundle_keeps_the_default_verification(monkeypatch):
    monkeypatch.setenv("LOAD_TEST_CA_BUNDLE", "")

    assert tls_verify() is True
