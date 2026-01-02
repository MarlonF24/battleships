from __future__ import annotations
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, responses, staticfiles
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from pathlib import Path
 
from .db import *
from .logging import logger

from .games import games_router
from .players import players_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with db_engine.begin() as conn:
        
        await conn.execute(text("DROP SCHEMA public CASCADE"))
        await conn.execute(text("CREATE SCHEMA public"))
        
        await conn.run_sync(Base.metadata.create_all)
    
    yield

    await db_engine.dispose()


app = FastAPI(lifespan=lifespan)

app.include_router(games_router)
app.include_router(players_router)

allowed =os.getenv("CORS_ALLOW_ORIGINS", "*")[1:-1].split(",")

logger.info(f"CORS allowed origins: {allowed}")
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BACKENDDIR = Path(__file__).parent
FROTENTDIR = BACKENDDIR.parent / "frontend/dist"
app.mount("/assets", staticfiles.StaticFiles(directory=FROTENTDIR / "assets"), name="assets")



@app.get("/{full_path:path}") # catch all route
def welcome(full_path: str) -> responses.FileResponse:
    return responses.FileResponse(FROTENTDIR / "index.html")



