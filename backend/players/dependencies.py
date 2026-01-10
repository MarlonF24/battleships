from uuid import UUID
from typing import Annotated

from fastapi import Depends, HTTPException, status

from ..db import SessionDep
from .relations import Player

async def validate_player(playerId: UUID, session: SessionDep) -> Player:
    player = await session.get(Player, playerId)
    if not player:
        print(f"Player with ID {playerId} not found")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Player not found")
    return player

PlayerDep = Annotated[Player, Depends(validate_player)] 