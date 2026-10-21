from fastapi import APIRouter

router = APIRouter(prefix="/interviews", tags=["interviews"])


# Placeholder so the router shows up in /docs; remove once real endpoints exist.
@router.get("/ping", include_in_schema=True)
def ping() -> dict[str, str]:
    return {"router": "interviews", "status": "ok"}
