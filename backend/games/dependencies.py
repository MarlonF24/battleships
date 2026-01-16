from uuid import UUID
from typing import Annotated

from fastapi import Depends, HTTPException, status
from sqlalchemy import select

from ..db import SessionDep
from ..players import PlayerDep
from .relations import Game, Player, Ship as DBShip
from .model.model import Ship


async def validate_game(gameId: UUID, session: SessionDep) -> Game:
    game = await session.get(Game, gameId)
    if not game:
        print(f"Game with ID {gameId} not found")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Game not found")
    return game

GameDep = Annotated[Game, Depends(validate_game)]


async def validate_player_in_game(
    player: PlayerDep,
    game: GameDep,
) -> tuple[Player, Game]:

    if player not in await game.awaitable_attrs.players:
        print(f"Player {player.id} not registered for game {game.id}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Player not registered for this game",
        )
    
    return player, game

PlayerGameDep = Annotated[tuple[Player, Game], Depends(validate_player_in_game)]

async def get_ships_for_player_in_game(
    player: PlayerDep,
    game: GameDep,
    session: SessionDep,
) -> list[Ship]:

    result = await session.scalars(
        select(DBShip).where(DBShip.game_id == game.id, DBShip.player_id == player.id)
    )
 
    test = [Ship(**ship.__dict__) for ship in result.all()]
    return test

ShipsDep = Annotated[list[Ship], Depends(get_ships_for_player_in_game)]


