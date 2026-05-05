from fastapi import Depends, HTTPException
from utils.security import verify_token


def require_role(allowed_roles: list):
    def wrapper(user=Depends(verify_token)):
        if user["role"] not in allowed_roles:
            raise HTTPException(status_code=403, detail="Forbidden")
        return user
    return wrapper