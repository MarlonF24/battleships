
from uuid import UUID
from dataclasses import dataclass, field
from typing import TypeVar, Generic, overload
from abc import ABC
from fastapi import WebSocket, WebSocketException, status, websockets

from backend.logger import logger

from ..model import GeneralServerMessage, ServerOpponentConnectionMessage



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

    def __iter__(self):
        return iter(self.players.items())

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
    
    def num_of_currently_connected(self) -> int:
        return sum(1 for conn in self.players.values() if conn.websocket.client_state == websockets.WebSocketState.CONNECTED)
    
    def currently_connected(self, player_id: UUID) -> bool:
        """Check if player is currently connected."""
        try:
            self.validate_player_in_game(player_id)
        except WebSocketException:
            raise WebSocketException(code=status.WS_1008_POLICY_VIOLATION, reason="Trying to check connection status of a player not in the game.")
        
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