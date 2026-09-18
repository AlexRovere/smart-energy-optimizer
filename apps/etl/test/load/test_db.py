# teste l'ouverture de la connexion PostgreSQL pour le Load
from unittest.mock import patch

from load.db import get_connection


@patch("load.db.psycopg2.connect")
@patch("load.db.get_postgres_connection_params")
def test_get_connection_opens_connection_with_configured_params(mock_get_params, mock_connect):
    mock_get_params.return_value = {
        "host": "localhost",
        "port": "5432",
        "dbname": "enervision",
        "user": "enervision",
        "password": "secret",
    }

    connection = get_connection()

    mock_connect.assert_called_once_with(
        host="localhost", port="5432", dbname="enervision", user="enervision", password="secret"
    )
    assert connection == mock_connect.return_value
