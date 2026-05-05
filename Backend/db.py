import os

import psycopg2


def get_connection():
    db_password = os.getenv("DB_PASSWORD")
    if not db_password:
        raise RuntimeError("DB_PASSWORD environment variable is not configured")

    return psycopg2.connect(
        host=os.getenv("DB_HOST", "localhost"),
        database=os.getenv("DB_NAME", "workplus"),
        user=os.getenv("DB_USER", "postgres"),
        password=db_password,
        port=os.getenv("DB_PORT", "5432"),
        connect_timeout=int(os.getenv("DB_CONNECT_TIMEOUT", "5")),
    )
