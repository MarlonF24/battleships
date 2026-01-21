from uuid import UUID

from fastapi import APIRouter, status

from . import service

from ..db import SessionDep
from .dependencies import PlayerDep, GameDep, PlayerGameDep, ShipsDep
from .model import PregameParams, GameParams
from .websockets import router as games_ws_router
from .relations import GamePhase

router = APIRouter(
    prefix="/games"
)

router.include_router(games_ws_router)

@router.post("/create", status_code=status.HTTP_201_CREATED)
async def create_game(request: PregameParams, session: SessionDep, player: PlayerDep) -> UUID:
    return await service.create_game(request, session, player)
    


@router.post("/{gameId}/join", status_code=status.HTTP_200_OK)
async def join_game(player: PlayerDep, game: GameDep, session: SessionDep) -> GamePhase:
    return await service.join_game(player, game, session)
    

@router.get("/{gameId}/phase", status_code=status.HTTP_200_OK)
async def get_game_phase(player_game: PlayerGameDep) -> GamePhase:
    game = player_game[1]
    return game.phase
    


@router.get("/{gameId}/params", status_code=status.HTTP_200_OK)
async def get_game_params(player_game: PlayerGameDep, ships: ShipsDep) -> GameParams:
    
    params = PregameParams.model_validate(player_game[1])

    return GameParams(**params.model_dump(), own_ships=ships)
