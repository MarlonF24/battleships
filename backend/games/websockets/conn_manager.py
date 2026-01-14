from uuid import UUID
from dataclasses import dataclass, field
from typing import AsyncGenerator, Generic, TypeVar, Any, Callable
from abc import ABC, abstractmethod
import betterproto
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import WebSocket, WebSocketException, websockets, status


from backend.logger import logger
from ..model import GamePlayerMessage, PregameServerMessage, GameServerMessage, ServerOpponentConnectionMessage, PlayerMessage, PlayerOpponentConnectionPoll, ServerMessage, GeneralServerMessage, GeneralPlayerMessage, PregamePlayerMessage
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
            raise WebSocketException(code=status._1008_POLICY_VIOLATION, reason="Attempted to add third player to game connections.")
        
        ...
    
    def num_players(self) -> int:
        return len(self.players)
    
    def validate_player_in_game(self, player_id: UUID):
        if player_id not in self.players:
            raise WebSocketException(code=status._1008_POLICY_VIOLATION, reason="Requested game connections data with foreign player ID.")


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
    

    def get_connection_message(self, player_id: UUID) -> GeneralServerMessage:
        self.validate_player_in_game(player_id)
        
        return GeneralServerMessage(opponent_connection_message=ServerOpponentConnectionMessage(
            opponent_connected=self.currently_connected(player_id),
            initially_connected=self.initially_connected(player_id)
        ))
    
    
    

GameConnectionsType = TypeVar('GameConnectionsType', bound=GameConnections[Any])

ServerMessageType = TypeVar('ServerMessageType', PregameServerMessage, GameServerMessage)
PlayerMessageType = TypeVar('PlayerMessageType', PregamePlayerMessage, GamePlayerMessage)

class ConnectionManager(ABC, Generic[GameConnectionsType, PlayerConnectionType, ServerMessageType, PlayerMessageType]):
    type MessageFactory = Callable[[UUID], ServerMessageType]

    def __init__(self):
        self.active_connections: dict[UUID, GameConnectionsType] = {} 
        self.server_message_payload_map: dict[type[betterproto.Message], str] = {
            field_type: field_name for field_name, field_type in ServerMessage.__annotations__.items()
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
        try:
            socket = self.get_player_connection(game, player)
            await socket.websocket.close() # probably redundant as fastapi should do this automatically
        
            logger.info(f"WebSocket connection closed for game {game.id}, player {player.id}")
        except Exception:
            logger.info(f"WebSocket connection for game {game.id}, player {player.id} was already closed.")
    
    async def send_server_message(self, websocket: WebSocket, message: ServerMessageType | GeneralServerMessage):
        message = ServerMessage(**{self.server_message_payload_map[type(message)]: message}) # type: ignore
        
        await websocket.send_bytes(bytes(message))

    async def broadcast(self, game: Game, sender: Player | None, message: ServerMessageType | GeneralServerMessage | MessageFactory, only_opponent: bool = False):
        #TODO: make more elegant, maybe remove player arg and pass sender as part in only_opponent arg
        if not sender and only_opponent:
            raise ValueError("Cannot broadcast only to opponent when sender is None.")

        for player_id, connection in self.get_game_connections(game).players.items():        
            if only_opponent and sender is not None and player_id == sender.id:
                continue

            if callable(message):
                message_instance = message(player_id)
            else:
                message_instance = message
    
            
            if connection.websocket.client_state == websockets.WebSocketState.CONNECTED:
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
        
        if opponent := game_conns.get_opponent_id(player.id):
            message = game_conns.get_connection_message(opponent)
            
            await self.send_personal_message(game, player, message) # type: ignore
            
            logger.info(f"Informed player {player.id} in game {game.id} about opponent's connection status.")




    async def handle_websocket(self, game: Game, player: Player, websocket: WebSocket, session: AsyncSession):
        try:
            await self.connect(game, player, websocket, session)
            await self.inform_opponent_about_own_connection(game, player)
            
            await self._handle_websocket(game, player, websocket, session)

        finally:
            await self.inform_opponent_about_own_connection(game, player)
        
            await self.disconnect(game, player)


    async def message_generator(self, websocket: WebSocket, game: Game, player: Player) -> AsyncGenerator[PlayerMessageType, None]:
        async for message in websocket.iter_bytes():

            message = PlayerMessage().parse(message)

            logger.info(f"Received WebSocket message in game {game.id} from player {player.id}")


            _, payload = betterproto.which_one_of(message, "payload")

            match payload:
                case GeneralPlayerMessage():
                    logger.info(f"Trying to read message as GeneralPlayerMessage in game {game.id} from player {player.id}")
                    await self.handle_general_player_message(game, player, payload)
                case _:
                    yield payload   
            
    
    async def handle_general_player_message(self, game: Game, player: Player, message: GeneralPlayerMessage):
        _, payload = betterproto.which_one_of(message, "payload")
        
        match payload:
            case PlayerOpponentConnectionPoll():
                logger.info(f"Received PlayerOpponentConnectionPoll from player {player.id} in game {game.id}: {message}")
                await self.inform_self_about_opponent_connection(game, player)
            case _:
                logger.warning(f"Received unknown GeneralPlayerMessage: {message}")

    
    @abstractmethod
    async def _handle_websocket(self, game: Game, player: Player, websocket: WebSocket, session: AsyncSession):
        ...

if __name__ == "__main__":
    pass