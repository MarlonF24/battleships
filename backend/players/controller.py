from uuid import UUID 
from fastapi import APIRouter, status

from ..db import SessionDep

from . import service

router = APIRouter(
    prefix="/players"
)

@router.post("/create", status_code=status.HTTP_201_CREATED)
async def create_player(session: SessionDep, playerId: UUID | None = None) -> UUID:
    return await service.create_player(session, playerId)
    