from fastapi import APIRouter

from api.routers.admins import router as admins_router
from api.routers.attendance import router as attendance_router
from api.routers.audit import router as audit_router
from api.routers.computers import router as computers_router
from api.routers.holidays import router as holidays_router
from api.routers.productivity import router as productivity_router
from api.routers.shifts import router as shifts_router
from api.routers.system import router as system_router
from api.routers.uploads import router as uploads_router
from api.routers.workforce import router as workforce_router

api_router = APIRouter()
api_router.include_router(admins_router)
api_router.include_router(workforce_router)
api_router.include_router(attendance_router)
api_router.include_router(computers_router)
api_router.include_router(productivity_router)
api_router.include_router(shifts_router)
api_router.include_router(holidays_router)
api_router.include_router(audit_router)
api_router.include_router(uploads_router)
api_router.include_router(system_router)
