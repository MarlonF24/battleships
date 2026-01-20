from dataclasses import dataclass
from uuid import UUID
from fastapi import WebSocket

from ..connection import GameConnections, PlayerConnection
from ...model import PregameServerReadyStateMessage


@dataclass
class PregamePlayerConnection(PlayerConnection):
    websocket: WebSocket
    ready: bool = False


@dataclass
class PregameGameConnections(GameConnections[PregamePlayerConnection]):
    

    def num_ready_players(self) -> int:
        return sum(1 for conn in self.players.values() if conn.ready)

    def get_ready_state(self, player_id: UUID) -> PregameServerReadyStateMessage:
        return PregameServerReadyStateMessage(
            num_ready_players=self.num_ready_players(),
            self_ready=self.players[player_id].ready
        )