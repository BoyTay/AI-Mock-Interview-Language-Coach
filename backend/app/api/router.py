from fastapi import APIRouter

from app.api import routes_english, routes_flashcards, routes_interview, routes_profile

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(routes_profile.router)
api_router.include_router(routes_interview.router)
api_router.include_router(routes_english.router)
api_router.include_router(routes_flashcards.router)
