# dont use form __future__ import annotations cause it breaks sqlmodel relationships

import os
from typing import Annotated
from fastapi import Depends
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.ext.asyncio import (
    create_async_engine,
    async_sessionmaker,
    AsyncSession,
    AsyncAttrs,
)

from backend.logger import logger

try:
    # no defaults, must be set in .env or environment
    user = os.getenv("DB_USER")
    password = os.getenv("DB_PASSWORD")
    db_name = os.getenv("DB_NAME")
    host = os.getenv("DB_HOST")
    port = os.getenv("DB_PORT", "5432")
except Exception as e:
    raise RuntimeError("Database configuration environment variables are not set correctly. Put a .env file NEXT TO the backend directory with DB_USER, DB_PASSWORD, DB_NAME, DB_HOST and optionally DB_PORT") from e

PG_DB_URL = f"postgresql+asyncpg://{user}:{password}@{host}:{port}/{db_name}"
logger.info(f"Using database at {host}:{port} with name {db_name}, user {user} and password {password}")

db_engine = create_async_engine(PG_DB_URL)

session_mkr: async_sessionmaker[AsyncSession] = async_sessionmaker(
    bind=db_engine, class_=AsyncSession, expire_on_commit=False
)


async def get_db_session():
    async with session_mkr() as session:
        yield session


SessionDep = Annotated[AsyncSession, Depends(get_db_session)]


class Base(AsyncAttrs, DeclarativeBase):
    pass
