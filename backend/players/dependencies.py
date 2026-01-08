from uuid import UUID

from fastapi import Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import Player, get_db_session

async def validate_player(playerId: UUID, session: AsyncSession = Depends(get_db_session)) -> Player:
    player = await session.get(Player, playerId)
    if not player:
        print(f"Player with ID {playerId} not found")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Player not found")
    return player 