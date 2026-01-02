
from fastapi import APIRouter, Depends, WebSocket
from sqlalchemy.ext.asyncio import AsyncSession

from ..dependencies import validate_player_in_game
from ...db import Player, Game, get_sb_session
from . import service

router = APIRouter(
    prefix="/ws",
)


@router.websocket("/{gameId}/pregame")
async def pregame_websocket(websocket: WebSocket, player_game: tuple[Player, Game] = Depends(validate_player_in_game), session: AsyncSession = Depends(get_sb_session)):
    player, game = player_game
    await service.pregame_websocket(websocket, player, game, session)



    