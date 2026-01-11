from uuid import UUID
from dataclasses import dataclass, field
from typing import Generic, TypeVar, Any, Callable
from abc import ABC, abstractmethod
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import WebSocket, WebSocketException, websockets, status


from backend.logger import logger
from ..model import PregameWSServerMessage, GameWSServerMessage, WSServerOpponentConnectionMessage
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
            raise WebSocketException(code=status.WS_1008_POLICY_VIOLATION, reason="Attempted to add third player to game connections.")
        
        ...
    
    def num_players(self) -> int:
        return len(self.players)
    
    def validate_player_in_game(self, player_id: UUID):
        if player_id not in self.players:
            raise WebSocketException(code=status.WS_1008_POLICY_VIOLATION, reason="Requested game connections data with foreign player ID.")


    def get_opponent_id(self, own_id: UUID) -> UUID | None:
        self.validate_player_in_game(own_id)
        
        for player_id in self.players.keys():
            if player_id != own_id:
                return player_id
        return None
    
    
    def currently_connected(self, player_id: UUID) -> bool:
        """Check if player is currently connected."""
        self.validate_player_in_game(player_id)
        
        return self.players[player_id].websocket.client_state == websockets.WebSocketState.CONNECTED
        
    
    def initially_connected(self, player_id: UUID) -> bool:
        """Check if player was connected at some time."""
        return player_id in self.players
    

    def get_connection_message(self, player_id: UUID) -> WSServerOpponentConnectionMessage:
        self.validate_player_in_game(player_id)
        
        return WSServerOpponentConnectionMessage(
            opponent_connected=self.currently_connected(player_id),
            initially_connected=self.initially_connected(player_id)
        )
    
    
    

GameConnectionsType = TypeVar('GameConnectionsType', bound=GameConnections[Any])

ServerMessageType = TypeVar('ServerMessageType', PregameWSServerMessage, GameWSServerMessage)


class ConnectionManager(ABC, Generic[GameConnectionsType, PlayerConnectionType, ServerMessageType]):
    type MessageFactory = Callable[[UUID], ServerMessageType]
    
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
        try:
            socket = self.get_player_connection(game, player)
            await socket.websocket.close() # probably redundant as fastapi should do this automatically
        
            logger.info(f"WebSocket connection closed for game {game.id}, player {player.id}")
        except Exception:
            pass
    

    async def broadcast(self, game: Game, sender: Player, message: ServerMessageType | MessageFactory, only_opponent: bool = False):
        for player_id, connection in self.get_game_connections(game).players.items():        
            if only_opponent and player_id == sender.id:
                continue

            if callable(message):
                message_instance = message(player_id)
            else:
                message_instance = message

            await connection.websocket.send_json(message_instance.model_dump())

    async def send_personal_message(self, game: Game, player: Player, message: ServerMessageType):        
        player_connection = self.get_player_connection(game, player)
        await player_connection.websocket.send_json(message.model_dump())



    async def inform_opponent_about_own_connection(self, game: Game, sender: Player):
        """Notify the opponent about the sender's connection status. If connected is True"""
        message = self.get_game_connections(game).get_connection_message(sender.id)
        await self.broadcast(game, sender, message, only_opponent=True) # type: ignore


    async def inform_self_about_opponent_connection(self, game: Game, player: Player, websocket: WebSocket):
        """Notify the player about the opponent's connection status."""
        game_conns = self.get_game_connections(game)
        
        if opponent := game_conns.get_opponent_id(player.id):
            message = game_conns.get_connection_message(opponent)
            await self.send_personal_message(game, player, message) # type: ignore


    async def initial_inform_connections(self, game: Game, player: Player, websocket: WebSocket):
        """Notify both players about each other's connection status upon initial connection."""
        await self.inform_opponent_about_own_connection(game, player)
        await self.inform_self_about_opponent_connection(game, player, websocket)



    async def clean_up(self, game: Game, player: Player):
        await self.inform_opponent_about_own_connection(game, player)
        logger.info(f"Informed opponent that Player {player.id} in game {game.id} has disconnected.")
        
        await self.disconnect(game, player)
        logger.info(f"WebSocket connection closed for game {game.id}, player {player.id}")
        


    async def handle_websocket(self, game: Game, player: Player, websocket: WebSocket, session: AsyncSession):
        try:
            await self.connect(game, player, websocket, session)
            await self.initial_inform_connections(game, player, websocket)
            
            await self._handle_websocket(game, player, websocket, session)

        finally:
            await self.clean_up(game, player)


    
    @abstractmethod
    async def _handle_websocket(self, game: Game, player: Player, websocket: WebSocket, session: AsyncSession):
        ...