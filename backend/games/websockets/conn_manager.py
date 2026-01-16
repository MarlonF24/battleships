from contextlib import asynccontextmanager
from uuid import UUID
from dataclasses import dataclass, field
from typing import AsyncGenerator, Generic, TypeVar, Any, Callable, overload
from abc import ABC, abstractmethod
import betterproto
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import WebSocket, WebSocketException, websockets, status
from unittest.mock import patch

from backend.logger import logger
from ..model import GamePlayerMessage, PregameServerMessage, GameServerMessage, ServerOpponentConnectionMessage, PlayerMessage, ServerMessage, GeneralServerMessage, PregamePlayerMessage
from ..relations import Game, Player


@dataclass
class PlayerConnection():
    websocket: WebSocket

PlayerConnectionType = TypeVar('PlayerConnectionType', bound=PlayerConnection)

@dataclass
class GameConnections(ABC, Generic[PlayerConnectionType]):
    players: dict[UUID, PlayerConnectionType] = field(default_factory=dict) # type: ignore
    
    def add_player(self, player_id: UUID, connection: PlayerConnectionType):
        if player_id not in self.players and len(self.players) >= 2:
            raise WebSocketException(code=status.WS_1008_POLICY_VIOLATION, reason="Attempted to add third player to game connections.")
        
        if player_id not in self.players:
            logger.info(f"Added player {player_id} to PregameGameConnections.")
            self.players[player_id] = connection
        else:
            logger.info(f"Player {player_id} reconnected. Updating connection.")
            self.players[player_id].websocket = connection.websocket
            
    
    def num_players(self) -> int:
        return len(self.players)
    
    def validate_player_in_game(self, player_id: UUID):
        if player_id not in self.players:
            
            raise WebSocketException(code=status.WS_1008_POLICY_VIOLATION, reason=f"Requested game connections data with foreign player ID. {player_id} not found in {list(self.players.keys())}.")



    @overload
    def get_opponent_id(self, own_id: UUID, raise_on_missing: str) -> UUID: ...
    @overload
    def get_opponent_id(self, own_id: UUID, raise_on_missing: None) -> UUID | None: ...
    def get_opponent_id(self, own_id: UUID, raise_on_missing: str | None = None) -> UUID | None:
        self.validate_player_in_game(own_id)
        
        for player_id in self.players.keys():
            if player_id != own_id:
                return player_id
        
        if raise_on_missing is not None:
            raise ValueError("Opponent ID not found.")
        
        return None
    
    
    def currently_connected(self, player_id: UUID) -> bool:
        """Check if player is currently connected."""
        try:
            self.validate_player_in_game(player_id)
        except WebSocketException:
            raise WebSocketException(code=1002, reason="Trying to check connection status of a player not in the game.")
        
        return self.players[player_id].websocket.client_state == websockets.WebSocketState.CONNECTED
        
    
    def initially_connected(self, player_id: UUID) -> bool:
        """Check if player was connected at some time."""
        return player_id in self.players
    

    def get_connection_message(self, player_id: UUID) -> GeneralServerMessage:
        self.validate_player_in_game(player_id)
        
        return GeneralServerMessage(opponent_connection_message=ServerOpponentConnectionMessage(
            opponent_connected=self.currently_connected(player_id),
            initially_connected=self.initially_connected(player_id)
        ))
    
    @overload
    def get_opponent_connection(self, own_id: UUID, raise_on_missing: str) -> PlayerConnectionType: ...
    @overload
    def get_opponent_connection(self, own_id: UUID, raise_on_missing: None) -> PlayerConnectionType | None: ...
    def get_opponent_connection(self, own_id: UUID, raise_on_missing: str | None = None) -> PlayerConnectionType | None:
        opponent_id = self.get_opponent_id(own_id, raise_on_missing=raise_on_missing)
        
        if opponent_id:
            return self.players[opponent_id]
        
        return None
    
    def remove_player(self, player_id: UUID):
        self.validate_player_in_game(player_id)
        
        del self.players[player_id]
        logger.info(f"Removed player {player_id} from GameConnections.")
    

GameConnectionsType = TypeVar('GameConnectionsType', bound=GameConnections[Any])

ServerMessageType = TypeVar('ServerMessageType', PregameServerMessage, GameServerMessage)
PlayerMessageType = TypeVar('PlayerMessageType', PregamePlayerMessage, GamePlayerMessage)

class ConnectionManager(ABC, Generic[GameConnectionsType, PlayerConnectionType, ServerMessageType, PlayerMessageType]):
    type MessageFactory = Callable[[UUID], ServerMessageType]

    def __init__(self):
        self.active_connections: dict[UUID, GameConnectionsType] = {} 
        self.server_message_payload_map: dict[type, str] = {
            field_type : field_name for field_name, field_type in ServerMessage._betterproto.cls_by_field.items() # type: ignore
        }


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
        try:
            await socket.websocket.close() # probably redundant as fastapi should do this automatically
        except Exception as e:
            logger.warning(f"Error closing WebSocket for game {game.id}, player {player.id}. Likely harmless as the socket might already be closed: {e}")
    
        logger.info(f"WebSocket connection closed for game {game.id}, player {player.id}")
    

    async def send_server_message(self, websocket: WebSocket, message: ServerMessageType | GeneralServerMessage):
        if websocket.client_state != websockets.WebSocketState.CONNECTED:
            raise WebSocketException(code=1002, reason="Attempting to send message on closed WebSocket.")
        
        message = ServerMessage(**{self.server_message_payload_map[type(message)]: message}) # type: ignore

        await websocket.send_bytes(bytes(message))

    async def broadcast(self, game: Game, sender: Player | None, message: ServerMessageType | GeneralServerMessage | MessageFactory, only_opponent: bool = False, raise_on_closed_socket: str | None = None):
        
        if not sender and only_opponent:
            raise ValueError("Cannot broadcast only to opponent when sender is None.")

        for player_id, connection in self.get_game_connections(game).players.items():        
            if only_opponent and sender is not None and player_id == sender.id:
                continue

            if callable(message):
                message_instance = message(player_id)
            else:
                message_instance = message
    
            
            if connection.websocket.client_state != websockets.WebSocketState.CONNECTED:
                if raise_on_closed_socket is not None:
                    raise WebSocketException(code=1002, reason=raise_on_closed_socket)
            else:
                await self.send_server_message(connection.websocket, message_instance)


    async def send_personal_message(self, game: Game, player: Player, message: ServerMessageType | GeneralServerMessage):        
        player_connection = self.get_player_connection(game, player)
        await self.send_server_message(player_connection.websocket, message)


    async def inform_opponent_about_own_connection(self, game: Game, sender: Player):
        """Notify the opponent about the sender's connection status. If connected is True"""
        
        message = self.get_game_connections(game).get_connection_message(sender.id)
        
        await self.broadcast(game, sender, message, only_opponent=True) 
        
        logger.info(f"Informed opponent of player {sender.id} in game {game.id} about connection status.")


    async def inform_self_about_opponent_connection(self, game: Game, player: Player):
        
        game_conns = self.get_game_connections(game)
        
        if opponent := game_conns.get_opponent_id(player.id, raise_on_missing=None):
            message = game_conns.get_connection_message(opponent)
            
            await self.send_personal_message(game, player, message) # type: ignore
            
            logger.info(f"Informed player {player.id} in game {game.id} about opponent's connection status.")


    async def start_up(self, game: Game, player: Player, websocket: WebSocket, session: AsyncSession):
        await self.connect(game, player, websocket, session)
        await self.inform_opponent_about_own_connection(game, player)
        await self.inform_self_about_opponent_connection(game, player)
        
    @abstractmethod
    async def clean_up(self, game: Game, player: Player, websocket: WebSocket, session: AsyncSession):
        if game.id not in self.active_connections:
            raise WebSocketException(code=1002, reason="Game connections not found during cleanup.")
        
        await self.inform_opponent_about_own_connection(game, player)
        await self.disconnect(game, player)
        # Implement how active connections are eventually removed from self.active_connections in subclasses

    @asynccontextmanager
    async def websocket_lifecycle(self, game: Game, player: Player, websocket: WebSocket, session: AsyncSession):
        try:
            logger.info(f"Starting WebSocket lifecycle for game {game.id}, player {player.id}")
            await self.start_up(game, player, websocket, session)
            
            yield

        finally:
            logger.info(f"Cleaning up WebSocket lifecycle for game {game.id}, player {player.id}")
            await self.clean_up(game, player, websocket, session)


    async def handle_websocket(self, game: Game, player: Player, websocket: WebSocket, session: AsyncSession):
        async with self.websocket_lifecycle(game, player, websocket, session):
            
            await self._handle_websocket(game, player, websocket, session)


    async def message_generator(self, websocket: WebSocket, game: Game, player: Player) -> AsyncGenerator[PlayerMessageType, None]:
        async for message in websocket.iter_bytes():
          
            # For some reason betterproto works like that Message().parse(bytes) but pydantic checks before we parse then, thus we circumvent validation like this:
            with patch.object(betterproto.Message, "_validate_field_groups", side_effect=lambda _: None): # type: ignore
                message_obj = PlayerMessage() 
                message_obj.parse(message) 

            logger.info(f"Received WebSocket message in game {game.id} from player {player.id}")


            _, payload = betterproto.which_one_of(message_obj, "payload")


            match payload:
                # case GeneralPlayerMessage():
                #     logger.info(f"Trying to read message as GeneralPlayerMessage in game {game.id} from player {player.id}")
                    
                case _:
                    yield payload  # type: ignore 
            
    

    @abstractmethod
    async def _handle_websocket(self, game: Game, player: Player, websocket: WebSocket, session: AsyncSession):
        ...

if __name__ == "__main__":
    pass