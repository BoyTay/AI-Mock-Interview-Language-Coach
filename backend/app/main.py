from fastapi import FastAPI

app = FastAPI(title="DevCoach AI")


@app.get("/health")
def health():
    return {"status": "ok"}
