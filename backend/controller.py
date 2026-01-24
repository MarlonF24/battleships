from __future__ import annotations
import asyncio
import os
from dotenv import load_dotenv
from pathlib import Path    
from typing import Awaitable, Callable


BACKENDDIR = Path(__file__).resolve().parent
load_dotenv(BACKENDDIR.parent / ".env")

from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, responses, staticfiles
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from .db import *
from .logger import logger

from .games import games_router, cleaner
from .players import players_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with db_engine.begin() as conn:
        
        if os.getenv("DROP_DB_ON_STARTUP", "False").lower() in ("true", "1", "yes"):
            logger.warning("Dropping and recreating public schema on startup as per DROP_DB_ON_STARTUP env var")
            await conn.execute(text("DROP SCHEMA public CASCADE"))
            await conn.execute(text("CREATE SCHEMA public"))

        await conn.run_sync(Base.metadata.create_all)


    # Set eager task factory for websockets
    asyncio.get_running_loop().set_task_factory(asyncio.eager_task_factory)
 
    asyncio.create_task(cleaner.run_passive_cleanup()) # start the passive cleaner

    yield

    await db_engine.dispose()


app = FastAPI(lifespan=lifespan)

app.include_router(games_router)
app.include_router(players_router)


if allowed := os.getenv("CORS_ALLOW_ORIGINS"):
    allowed = [origin.strip() for origin in allowed.split(",")]

    logger.info(f"CORS allowed origins: {allowed}")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed,
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )


FROTENTDIR = BACKENDDIR.parent / "frontend/dist"

app.mount(
    "/assets", staticfiles.StaticFiles(directory=FROTENTDIR / "assets"), name="assets"
)



@app.middleware("http")
async def noise_filter(request: Request, call_next: Callable[[Request], Awaitable[responses.Response]]):
    """Catching noisy requests"""
    path = request.url.path
    if ".well-known" in path or path.endswith(".php"):
        return responses.Response(status_code=404)
    return await call_next(request)



@app.get("/{full_path:path}")  # catch all route
def welcome(full_path: str) -> responses.FileResponse:
    file_path = FROTENTDIR / full_path

    if file_path.exists() and file_path.is_file():
        logger.info(f"Serving static file from path: {full_path}")
        return responses.FileResponse(file_path)

    logger.info(f"Redirecting to welcome page from path: {full_path}")
    return responses.FileResponse(FROTENTDIR / "index.html")
