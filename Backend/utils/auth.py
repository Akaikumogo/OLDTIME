from fastapi import Depends, HTTPException, Request
from utils.security import verify_token


def require_role(allowed_roles: list):
    def wrapper(request: Request, user=Depends(verify_token)):
        role = user["role"]
        if role == "superadmin":
            return user
        if role == "hr" and request.method not in ("GET", "HEAD", "OPTIONS"):
            raise HTTPException(status_code=403, detail="HR role is read-only")
        if role not in allowed_roles:
            raise HTTPException(status_code=403, detail="Forbidden")
        return user
    return wrapper
