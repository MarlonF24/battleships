from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import Game, Player
from .model import GameParams


from . import service
from . import dependencies
from .websockets import router as ws_router


router = APIRouter(
    prefix="/games"
)

router.include_router(ws_router)

@router.post("/create", status_code=status.HTTP_201_CREATED)
async def create_game(request: GameParams, session: AsyncSession = Depends(dependencies.get_db_session), player: Player = Depends(dependencies.validate_player)) -> UUID:
    return await service.create_game(request, session, player)
    


@router.post("/{gameId}/join", status_code=status.HTTP_204_NO_CONTENT)
async def join_game(player: Player = Depends(dependencies.validate_player), game: Game = Depends(dependencies.validate_game), session: AsyncSession = Depends(dependencies.get_db_session)):
    return await service.join_game(player, game, session)
    


@router.get("/{gameId}/params", status_code=status.HTTP_200_OK)
def get_pregame_params(player_game: tuple[Player, Game] = Depends(dependencies.validate_player_in_game)) -> GameParams:
    
    return GameParams.model_validate(player_game[1])

# @router.get("/games/{gameId}/state", status_code=status.HTTP_200_OK)
# async def get_game_state(player_game: tuple[Player, Game] = Depends(dependencies.validate_player_in_game), session: AsyncSession = Depends(dependencies.get_db_session)):
#     return await service.get_game_state(player_game[0], player_game[1], session)
