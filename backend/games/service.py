from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError

from backend.games.relations import GamePhase
from backend.logger import logger
from backend.players import Player

from .relations import Game, GamePlayerLink
from .model import PregameParams


async def create_game(
    request: PregameParams, session: AsyncSession, player: Player
) -> UUID:

    game_instance = Game(**request.model_dump())

    session.add(game_instance)

    await session.flush()

    game_player_link = GamePlayerLink(
        game_id=game_instance.id, player_id=player.id, player_slot=1
    )

    session.add(game_player_link)

    await session.flush()

    await session.commit()

    logger.info(f"Created game with ID: {game_instance.id} for player ID: {player.id}")

    return game_instance.id


async def join_game(player: Player, game: Game, session: AsyncSession) -> GamePhase:
    current_players = await game.awaitable_attrs.players

    num_current_players = len(current_players)

    if num_current_players == 0:
        logger.critical(
            f"Player ID {player.id} tried to join game ID {game.id} which has no players. Such a game should not exist. Games must be created with one player."
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unable to join game. It may be full or you are already joined.",
        )
    
    if game.phase == GamePhase.COMPLETED:
        logger.warning(
            f"Player ID {player.id} attempted to join completed game ID {game.id}"
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unable to join completed game.",
        )

    if not player in current_players:
        if num_current_players == 1:
            try:
                session.add(
                    GamePlayerLink(game_id=game.id, player_id=player.id, player_slot=2)
                )
                await session.commit()

                logger.info(f"Player ID {player.id} joined game ID {game.id}")

            except IntegrityError as e:
                logger.critical(
                    f"IntegrityError: Player ID {player.id} could not join game ID {game.id}. Possibly because the game creator was saved in slot 2. This should never happen. Error: {e}"
                )
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT, detail="Unable to join game."
                )

        else:
            logger.warning(
                f"Player ID {player.id} attempted to join full game ID {game.id}"
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Unable to join full game.",
            )


    return game.phase
