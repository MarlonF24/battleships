from uuid import UUID
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError


from backend.logging import logger
from ..db import Player

async def create_player(session: AsyncSession, playerId: UUID | None = None) -> UUID:
    if playerId:
        if existing_player := (await session.execute(select(Player).where(Player.id == playerId))).scalars().first():
            logger.info(f"Returning already existing player with ID {existing_player.id}.")
            return existing_player.id
    
    logger.info("Creating new player.")
    player_instance = Player(id=playerId)  # default_factory will create new uuid if None
    
    session.add(player_instance)
    
    try:
        await session.commit()
        await session.refresh(player_instance)
        logger.info(f"Created player with ID: {player_instance.id}")
    
    # catch unlikely uuid collision, other exceptions will propagate
    except IntegrityError as e:
        logger.error(f"IntegrityError creating player: {e}")
        await session.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create player")

    logger.info(f"Returning new player with ID {player_instance.id}.")
    return player_instance.id