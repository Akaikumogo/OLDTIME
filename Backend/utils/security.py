import os
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

SECRET_KEY = os.getenv("JWT_SECRET_KEY")
ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
security = HTTPBearer()
optional_security = HTTPBearer(auto_error=False)


def _get_secret_key() -> str:
    if not SECRET_KEY:
        raise HTTPException(status_code=500, detail="JWT secret key is not configured")
    if len(SECRET_KEY.encode("utf-8")) < 32:
        raise HTTPException(status_code=500, detail="JWT secret key must be at least 32 bytes")
    return SECRET_KEY


def hash_password(password: str):
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str):
    return bcrypt.checkpw(password.encode(), hashed.encode())


def _decode_jwt(token: str) -> dict:
    try:
        return jwt.decode(token, _get_secret_key(), algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


def _decode_token(token: str):
    payload = _decode_jwt(token)
    return {
        "user_id": payload.get("user_id"),
        "role": payload.get("role"),
    }


def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    return _decode_token(credentials.credentials)


def optional_verify_token(
    credentials: HTTPAuthorizationCredentials | None = Depends(optional_security),
):
    if credentials is None:
        return None
    return _decode_token(credentials.credentials)


def create_access_token(data: dict, expires_in_days: int = 7):
    payload = data.copy()
    payload["type"] = "access"
    payload["exp"] = datetime.now(timezone.utc) + timedelta(days=expires_in_days)
    return jwt.encode(payload, _get_secret_key(), algorithm=ALGORITHM)


def create_refresh_token(data: dict, expires_in_days: int = 30):
    payload = data.copy()
    payload["type"] = "refresh"
    payload["exp"] = datetime.now(timezone.utc) + timedelta(days=expires_in_days)
    return jwt.encode(payload, _get_secret_key(), algorithm=ALGORITHM)


def verify_refresh_token(refresh_token: str):
    payload = _decode_jwt(refresh_token)
    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    return {
        "user_id": payload.get("user_id"),
        "role": payload.get("role"),
    }


# Backwards-compatible alias (used by existing routers/services)
def create_token(data: dict):
    return create_access_token(data)
