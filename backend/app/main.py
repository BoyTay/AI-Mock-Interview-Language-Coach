from fastapi import FastAPI

from app.api.router import api_router
from app.core.errors import register_error_handlers

app = FastAPI(title="DevCoach AI")
register_error_handlers(app)
app.include_router(api_router)


@app.get("/health")
def health():
    return {"status": "ok"}
