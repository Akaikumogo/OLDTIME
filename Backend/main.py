from contextlib import asynccontextmanager
from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI
from dotenv import load_dotenv

load_dotenv()

from api.router import api_router
from core.docs import tags_metadata
from services.db_init import initialize_database
from services.hikvision_service import HikvisionPollingEngine


@asynccontextmanager
async def lifespan(app: FastAPI):
    initialize_database()
    engine = HikvisionPollingEngine()
    app.state.hikvision_engine = engine
    try:
        engine.start()
    except Exception as exc:
        print(f"[WARN] Hikvision poller failed to start: {exc}")
    try:
        yield
    finally:
        try:
            engine.stop()
        except Exception as exc:
            print(f"[WARN] Hikvision poller stop failed: {exc}")

app = FastAPI(
    title="WorkPlus API",
    description="WorkPlus HR backend with admin auth and workforce management modules.",
    version="1.0.0",
    lifespan=lifespan,
    openapi_tags=tags_metadata,
    swagger_ui_parameters={
        "defaultModelsExpandDepth": -1,
        "displayRequestDuration": True,
        "docExpansion": "list",
        "filter": True,
    },
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5173",
        "http://192.0.4.158:5173"
    ],
   
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/", tags=["Admins"], summary="Health check")
def root():
    return {"message": "WorkPlus backend running"}


app.include_router(api_router)
