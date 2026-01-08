from uuid import UUID

from fastapi import Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import Game, get_db_session, Player
from ..players import validate_player


async def validate_game(gameId: UUID, session: AsyncSession = Depends(get_db_session)) -> Game:
    game = await session.get(Game, gameId)
    if not game:
        print(f"Game with ID {gameId} not found")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Game not found")
    return game


async def validate_player_in_game(
    player: Player = Depends(validate_player),
    game: Game = Depends(validate_game),
) -> tuple[Player, Game]:
    
    if player not in await game.awaitable_attrs.players:
        print(f"Player {player.id} not registered for game {game.id}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Player not registered for this game",
        )
    
    return player, game


