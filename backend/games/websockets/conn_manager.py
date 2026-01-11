from uuid import UUID
from dataclasses import dataclass, field
from typing import Generic, TypeVar, Any
from abc import ABC, abstractmethod
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import WebSocket, WebSocketException, status


from backend.logger import logger
from ..model import WSServerMessage
from ..relations import Game, Player


@dataclass
class PlayerConnection():
    websocket: WebSocket

PlayerConnectionType = TypeVar('PlayerConnectionType', bound=PlayerConnection)

@dataclass
class GameConnections(ABC, Generic[PlayerConnectionType]):
    players: dict[UUID, PlayerConnectionType] = field(default_factory=dict) # type: ignore
    
    @abstractmethod
    def add_player(self, player_id: UUID, connection: PlayerConnectionType):
        if player_id not in self.players and len(self.players) >= 2:
            raise WebSocketException(code=status.WS_1008_POLICY_VIOLATION, reason="Already two players connected.")
        
        ...

    def contains_player(self, player_id: UUID) -> bool:
        return player_id in self.players
    

GameConnectionsType = TypeVar('GameConnectionsType', bound=GameConnections[Any])

ServerMessageType = TypeVar('ServerMessageType', bound=WSServerMessage)

class ConnectionManager(ABC, Generic[GameConnectionsType, PlayerConnectionType, ServerMessageType]):
    def __init__(self):
            self.active_connections: dict[UUID, GameConnectionsType] = {} 

    def get_game_connections(self, game: Game) -> GameConnectionsType:
        return self.active_connections[game.id]

    def get_player_connection(self, game: Game, player: Player) -> PlayerConnectionType:
        return self.get_game_connections(game).players[player.id]
    
    @abstractmethod
    async def connect(self, game: Game, player: Player, websocket: WebSocket, session: AsyncSession):
        
        await websocket.accept() 
        logger.info(f"WebSocket connection accepted for game {game.id}, player {player.id}")


    async def disconnect(self, game: Game, player: Player):
        socket = self.get_player_connection(game, player)
        await socket.websocket.close() # probably redundant as fastapi should do this automatically

        logger.info(f"WebSocket connection closed for game {game.id}, player {player.id}")
    

    async def broadcast(self, game: Game, sender: Player, message: ServerMessageType, only_opponent: bool = False):
        for player_id, connection in self.get_game_connections(game).players.items():        
            if only_opponent and player_id == sender.id:
                continue
            await connection.websocket.send_json(message.model_dump())

    @abstractmethod
    async def handle_websocket(self, game: Game, player: Player, websocket: WebSocket, session: AsyncSession):
        ...