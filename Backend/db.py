import os
import threading
from contextlib import contextmanager
from typing import Optional

import psycopg2
from psycopg2 import pool as psycopg2_pool

_pool_lock = threading.Lock()
_pool: Optional[psycopg2_pool.ThreadedConnectionPool] = None


def _read_pool_size() -> tuple[int, int]:
    minconn = int(os.getenv("DB_POOL_MIN_SIZE", "1"))
    maxconn = int(os.getenv("DB_POOL_MAX_SIZE", "10"))
    if minconn < 1:
        minconn = 1
    if maxconn < minconn:
        maxconn = minconn
    return minconn, maxconn


def _make_pool() -> psycopg2_pool.ThreadedConnectionPool:
    db_password = os.getenv("DB_PASSWORD")
    if not db_password:
        raise RuntimeError("DB_PASSWORD environment variable is not configured")
    minconn, maxconn = _read_pool_size()
    return psycopg2_pool.ThreadedConnectionPool(
        minconn=minconn,
        maxconn=maxconn,
        host=os.getenv("DB_HOST", "localhost"),
        database=os.getenv("DB_NAME", "workplus"),
        user=os.getenv("DB_USER", "postgres"),
        password=db_password,
        port=os.getenv("DB_PORT", "5432"),
        connect_timeout=int(os.getenv("DB_CONNECT_TIMEOUT", "5")),
    )


def _get_pool() -> psycopg2_pool.ThreadedConnectionPool:
    global _pool
    if _pool is not None:
        return _pool
    with _pool_lock:
        if _pool is None:
            _pool = _make_pool()
    return _pool


class _PooledConnection:
    """
    psycopg2 connection wrapper'i. Context manager interfeysida ishlaydi
    (`with get_connection() as conn:`) va exit'da connection'ni pool'ga qaytaradi.
    """

    __slots__ = ("_conn", "_pool")

    def __init__(self, conn, pool):
        self._conn = conn
        self._pool = pool

    def __getattr__(self, item):
        return getattr(self._conn, item)

    def __enter__(self):
        return self._conn

    def __exit__(self, exc_type, exc, tb):
        try:
            if exc_type is not None:
                try:
                    self._conn.rollback()
                except Exception:
                    pass
        finally:
            try:
                self._pool.putconn(self._conn)
            except Exception:
                # Pool yopilgan bo'lsa, connection'ni o'zi yopamiz
                try:
                    self._conn.close()
                except Exception:
                    pass


def get_connection():
    """
    Pool'dan connection oladi. `with get_connection() as conn:` shaklida ishlatish
    avvalgi kod bilan to'liq mos keladi (interface o'zgarmagan).
    """
    pool = _get_pool()
    conn = pool.getconn()
    return _PooledConnection(conn, pool)


def close_pool():
    global _pool
    with _pool_lock:
        if _pool is not None:
            try:
                _pool.closeall()
            except Exception:
                pass
            _pool = None
