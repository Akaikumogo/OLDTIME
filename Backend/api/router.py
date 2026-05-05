from fastapi import APIRouter

from api.routers.admins import router as admins_router
from api.routers.attendance import router as attendance_router
from api.routers.computers import router as computers_router
from api.routers.workforce import router as workforce_router

api_router = APIRouter()
api_router.include_router(admins_router)
api_router.include_router(workforce_router)
api_router.include_router(attendance_router)
api_router.include_router(computers_router)
