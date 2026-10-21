from fastapi import APIRouter

router = APIRouter(prefix="/profile", tags=["profile"])


# Placeholder so the router shows up in /docs; remove once real endpoints exist.
@router.get("/ping", include_in_schema=True)
def ping() -> dict[str, str]:
    return {"router": "profile", "status": "ok"}
