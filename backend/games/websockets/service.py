from fastapi import WebSocket, WebSocketException, status
from pydantic import BaseModel
from uuid import UUID
from collections import defaultdict
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import update


from backend.logging import logger

from ...db import Player, Game, GamePlayerLink
from .model import PregameWSServerMessage, PregameWSPlayerReadyMessage


class PlayerConnection(BaseModel):
    websocket: WebSocket
    ready: bool = False
    
    model_config = {"arbitrary_types_allowed": True}

class GameConnections(BaseModel):
    players: dict[UUID, PlayerConnection] = {}
    
    model_config = {"arbitrary_types_allowed": True}

    def add_player(self, player_id: UUID, connection: PlayerConnection):
        self.players[player_id] = connection

    def num_ready_players(self) -> int:
        return sum(1 for conn in self.players.values() if conn.ready)


class PregameConnectionManager:
    def __init__(self):
            self.active_connections: dict[UUID, GameConnections] = defaultdict(GameConnections)

    def get_game_connections(self, game_id: UUID) -> GameConnections:
        return self.active_connections[game_id]

    def get_player_connection(self, game_id: UUID, player_id: UUID) -> PlayerConnection | None:
        return self.get_game_connections(game_id).players.get(player_id)
    

    async def connect(self, game_id: UUID, user_id: UUID, websocket: WebSocket):
        # if self.get_player_connection(game_id, user_id):
        #     await self.disconnect(game_id, user_id)  # Disconnect existing connection for this user in the game
        
        
        await websocket.accept()
        logger.info(f"WebSocket connection accepted for game {game_id}, player {user_id}")
        self.active_connections[game_id].add_player(user_id, PlayerConnection(websocket=websocket))

    async def disconnect(self, game_id: UUID, user_id: UUID):
        if socket := self.get_player_connection(game_id, user_id): # type: ignore
            # await socket.websocket.close() # probably redundant as fastapi should do this automatically
    
            del self.active_connections[game_id].players[user_id]
            if not self.active_connections[game_id].players:  # Remove game entry if empty
                del self.active_connections[game_id]


    async def broadcast(self, game_id: UUID, message: PregameWSServerMessage):
        for connection in self.get_game_connections(game_id).players.values():        
            await connection.websocket.send_json(message.model_dump())


conn_manager = PregameConnectionManager()


async def pregame_websocket(websocket: WebSocket, player: Player, game: Game, session: AsyncSession):
    await conn_manager.connect(game.id, player.id, websocket)

    try:
        # initial send of current ready count
        num_players_ready = conn_manager.get_game_connections(game.id).num_ready_players()
        await websocket.send_json(PregameWSServerMessage(num_players_ready=num_players_ready).model_dump())

        async for message in websocket.iter_json():
            logger.info(f"Received WebSocket message: {message}")
            message = PregameWSPlayerReadyMessage.model_validate(message)  
            
            if not (conn := conn_manager.get_player_connection(game.id, player.id)):
                raise WebSocketException(code=status.WS_1008_POLICY_VIOLATION, reason="Player not connected")
            
            # update readiness state
            conn.ready = True
            
            # update ship placements in DB (after a server crash this will just overwrite with last known placements, wanted!)
            await session.execute(
                update(GamePlayerLink)
                .where(GamePlayerLink.game_id == game.id, GamePlayerLink.player_id == player.id)
                .values(ship_positions=message.model_dump()["shipPositions"])
            )
            await session.commit()

            num_players_ready = conn_manager.get_game_connections(game.id).num_ready_players()
            
            # broadcast updated ready count to both players
            await conn_manager.broadcast(game.id, PregameWSServerMessage(num_players_ready=num_players_ready))

    finally:
        await conn_manager.disconnect(game.id, player.id)
        logger.info(f"WebSocket connection closed for game {game.id}, player {player.id}")