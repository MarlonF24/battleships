from uuid import UUID

from fastapi import Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import Game, get_sb_session, Player
from ..players import validate_player


async def validate_game(gameId: UUID, session: AsyncSession = Depends(get_sb_session)) -> Game:
    game = await session.get(Game, gameId)
    if not game:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Game not found")
    return game


async def validate_player_in_game(
    player: Player = Depends(validate_player),
    game: Game = Depends(validate_game),
    session: AsyncSession = Depends(get_sb_session),
) -> tuple[Player, Game]:
    
    if player not in await game.awaitable_attrs.players:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Player not registered for this game",
        )
    
    return player, game


