from fastapi import APIRouter

router = APIRouter(prefix="/english", tags=["english"])


# Placeholder so the router shows up in /docs; remove once real endpoints exist.
@router.get("/ping", include_in_schema=True)
def ping() -> dict[str, str]:
    return {"router": "english", "status": "ok"}
