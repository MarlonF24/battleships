from uuid import UUID 
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db_session

from . import service

router = APIRouter(
    prefix="/players"
)

@router.post("/create", status_code=status.HTTP_201_CREATED)
async def create_player(playerId: UUID | None = None, session: AsyncSession = Depends(get_db_session)) -> UUID:
    return await service.create_player(session, playerId)
    