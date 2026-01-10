from uuid import UUID

from fastapi import APIRouter, status

from . import service

from ..db import SessionDep
from .dependencies import PlayerDep, GameDep, PlayerGameDep, ShipsDep
from .model import PregameParams, GameParams
from .websockets import router as games_ws_router

router = APIRouter(
    prefix="/games"
)

router.include_router(games_ws_router)

@router.post("/create", status_code=status.HTTP_201_CREATED)
async def create_game(request: PregameParams, session: SessionDep, player: PlayerDep) -> UUID:
    return await service.create_game(request, session, player)
    


@router.post("/{gameId}/join", status_code=status.HTTP_204_NO_CONTENT)
async def join_game(player: PlayerDep, game: GameDep, session: SessionDep):
    return await service.join_game(player, game, session)
    



@router.get("/{gameId}/pregame/params", status_code=status.HTTP_200_OK)
def get_pregame_params(player_game: PlayerGameDep) -> PregameParams:
    
    return PregameParams.model_validate(player_game[1])


@router.get("/games/{gameId}/game/params", status_code=status.HTTP_200_OK)
async def get_game_params(player_game: PlayerGameDep, ships: ShipsDep) -> GameParams:
    
    pregame_params = PregameParams.model_validate(player_game[1])

    return GameParams(
        battle_grid_rows=pregame_params.battle_grid_rows,
        battle_grid_cols=pregame_params.battle_grid_cols,
        ship_lengths=pregame_params.ship_lengths, 
        own_ships=ships
    )
