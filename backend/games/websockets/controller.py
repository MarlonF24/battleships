
from fastapi import APIRouter, WebSocket


from ..dependencies import PlayerGameDep
from ...db import SessionDep
from .game.conn_manager import conn_manager as game_conn_manager
from .pregame.conn_manager import conn_manager as pregame_service


router = APIRouter(
    prefix="/ws",
)


@router.websocket("/{gameId}/pregame")
async def pregame_websocket(websocket: WebSocket, player_game: PlayerGameDep, session: SessionDep):
    player, game = player_game

    await pregame_service.handle_websocket(game, player, websocket, session)


@router.websocket("/{gameId}/game")
async def game_websocket(websocket: WebSocket, player_game: PlayerGameDep, session: SessionDep):
    player, game = player_game
    
    await game_conn_manager.handle_websocket(game, player, websocket, session)

