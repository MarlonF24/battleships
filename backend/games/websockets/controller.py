
from fastapi import APIRouter, WebSocket
from typing import Union


from ..dependencies import PlayerGameDep
from ...db import SessionDep
from .game import conn_manager as game_conn_manager
from .pregame import conn_manager as pregame_service


from ..model import WSMessage

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




# This endpoint is only to register all WebSocket message models in the OpenAPI schema. So that we can use the api-client generator to generate TypeScript types for them.
async def schema_dummy(data: WSMessage):
    return {"detail": "This endpoint should not be called."}


def get_all_subclasses(cls: type) -> set[type]:
    return set(cls.__subclasses__()).union(
        [s for c in cls.__subclasses__() for s in get_all_subclasses(c)])


all_message_models = tuple(get_all_subclasses(WSMessage))

schema_dummy.__annotations__["data"] = Union[all_message_models]

router.add_api_route("/_schema_dummy", endpoint=schema_dummy, methods=["GET"], include_in_schema=True)


    