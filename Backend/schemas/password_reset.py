from pydantic import BaseModel


class PasswordResetRequest(BaseModel):
    accessPassword: str
    email: str
    password: str


class PasswordResetResponse(BaseModel):
    message: str
