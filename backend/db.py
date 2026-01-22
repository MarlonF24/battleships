# dont use form __future__ import annotations cause it breaks sqlmodel relationships

import os, dotenv
from typing import Annotated
from fastapi import Depends
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.ext.asyncio import (
    create_async_engine,
    async_sessionmaker,
    AsyncSession,
    AsyncAttrs,
)


dotenv.load_dotenv()


PG_DB_URL = os.getenv("PG_DB_URL")

if not PG_DB_URL:
    raise ValueError("PG_DB_URL environment variable is not set in .env file")

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
