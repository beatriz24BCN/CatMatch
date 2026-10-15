from fastapi import FastAPI
from .core.config import settings

# import routers
from .api.routers import cats as cats_router
from .api.routers import match as match_router
from .api.routers import persons as persons_router
from .api.routers import adoption_requests as adoption_requests_router

app = FastAPI(title="CatMatch API")

# include API routers
app.include_router(cats_router.router)
app.include_router(match_router.router)
app.include_router(persons_router.router)
app.include_router(adoption_requests_router.router)


@app.get("/health")
async def health():
    return {"status": "ok", "app": "CatMatch backend", "env": settings.env}

