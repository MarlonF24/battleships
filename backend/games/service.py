from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError

from backend.logging import logger
from backend.players import Player

from .relations import Game, GamePlayerLink
from .model import PregameParams


async def create_game(request: PregameParams, session: AsyncSession, player: Player) -> UUID:
    game_instance = Game(**request.model_dump())
    
    session.add(game_instance)
    
    await session.flush()

    game_player_link = GamePlayerLink(game_id=game_instance.id, player_id=player.id, player_slot=1)
    
    session.add(game_player_link)
    
    await session.commit()

    logger.info(f"Created game with ID: {game_instance.id} for player ID: {player.id}")
    return game_instance.id


async def join_game(player: Player, game: Game, session: AsyncSession):
    try:
        session.add(GamePlayerLink(game_id=game.id, player_id=player.id, player_slot=2))
        await session.commit()
    except IntegrityError:
        await session.rollback()
        print("IntegrityError: Unable to join game.")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unable to join game. It may be full or you are already joined.")