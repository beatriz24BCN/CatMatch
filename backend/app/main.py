from fastapi import FastAPI
from .core.config import settings

app = FastAPI(title="CatMatch API")


@app.get("/health")
async def health():
    return {"status": "ok", "app": "CatMatch backend", "env": settings.env}

