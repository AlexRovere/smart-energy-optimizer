# autorité TLS des utilisateurs Locust du dashboard : LOAD_TEST_CA_BUNDLE, sinon celle par défaut
from __future__ import annotations

import os


def tls_verify() -> str | bool:
    return os.getenv("LOAD_TEST_CA_BUNDLE") or True
