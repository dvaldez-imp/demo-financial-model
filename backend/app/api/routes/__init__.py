from fastapi import APIRouter

from app.api.routes.activity_log import router as activity_log_router
from app.api.routes.admin import router as admin_router
from app.api.routes.catalog import router as catalog_router
from app.api.routes.health import router as health_router
from app.api.routes.library import router as library_router
from app.api.routes.models import router as models_router
from app.api.routes.premises import router as premises_router
from app.api.routes.scenarios import router as scenarios_router

api_router = APIRouter()
api_router.include_router(health_router)
api_router.include_router(admin_router)
api_router.include_router(models_router)
api_router.include_router(library_router)
api_router.include_router(premises_router)
api_router.include_router(scenarios_router)
api_router.include_router(catalog_router)
api_router.include_router(activity_log_router)
