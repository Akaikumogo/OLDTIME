import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

load_dotenv()

from api.router import api_router
from core.docs import tags_metadata
from services.db_init import initialize_database
from services.hikvision_service import HikvisionPollingEngine
from services.service_supervisor import ServiceSupervisor
from services.storage_service import (
    get_employee_photo_dir,
    get_face_captures_dir,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    initialize_database()
    engine = HikvisionPollingEngine()
    app.state.hikvision_engine = engine
    try:
        engine.start()
    except Exception as exc:
        print(f"[WARN] Hikvision poller failed to start: {exc}")

    # go2rtc + odam aniqlash worker'ini backend o'zi ko'taradi
    supervisor = ServiceSupervisor()
    app.state.service_supervisor = supervisor
    try:
        supervisor.start_all()
    except Exception as exc:
        print(f"[WARN] Service supervisor failed to start: {exc}")

    try:
        yield
    finally:
        try:
            supervisor.stop_all()
        except Exception as exc:
            print(f"[WARN] Service supervisor stop failed: {exc}")
        try:
            engine.stop()
        except Exception as exc:
            print(f"[WARN] Hikvision poller stop failed: {exc}")


app = FastAPI(
    title="WorkPlus API",
    description="WorkPlus HR backend with admin auth, workforce, attendance, productivity and computer monitoring modules.",
    version="1.1.0",
    lifespan=lifespan,
    openapi_tags=tags_metadata,
    swagger_ui_parameters={
        "defaultModelsExpandDepth": -1,
        "displayRequestDuration": True,
        "docExpansion": "list",
        "filter": True,
    },
)

# CORS — frontend host'lar
_cors_origins_env = os.getenv("CORS_ORIGINS", "")
_default_origins = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5173",
    "http://192.168.0.165:5173",
]
_cors_origins = [
    origin.strip()
    for origin in _cors_origins_env.split(",")
    if origin.strip()
] or _default_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Static files: frontend rasmlarni shu URL'lar orqali ko'radi
# /static/employee_photos/<file>  va  /static/face_captures/<file>
app.mount(
    "/static/employee_photos",
    StaticFiles(directory=str(get_employee_photo_dir())),
    name="employee_photos",
)
app.mount(
    "/static/face_captures",
    StaticFiles(directory=str(get_face_captures_dir())),
    name="face_captures",
)


@app.get("/", tags=["Admins"], summary="Health check")
def root():
    return {"message": "WorkPlus backend running"}


app.include_router(api_router)
