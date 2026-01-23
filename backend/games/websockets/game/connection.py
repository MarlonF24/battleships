import asyncio

from dataclasses import dataclass, field
from uuid import UUID

from ...model import GameServerStateMessage, ShipGrid
from ..connection import GameConnections, PlayerConnection
from ...relations import GameMode


@dataclass
class GamePlayerConnection(PlayerConnection):
    ship_grid: ShipGrid


@dataclass
class GameGameConnections(GameConnections[GamePlayerConnection]):
    mode: GameMode = field(default=GameMode.SINGLESHOT)
    first_to_shoot: UUID | None = None
    turn_player_id: UUID | None = None
    _started: bool = field(default=False, init=False)
    _ended: bool = field(default=False, init=False)
    shot_lock: asyncio.Lock = field(default_factory=asyncio.Lock, init=False)
    reconnect_event: asyncio.Event = field(default_factory=asyncio.Event, init=False)
    salvo_shots_remaining: int = field(default=3, init=False)

    async def add_player(self, player_id: UUID, connection: GamePlayerConnection):
        await super().add_player(player_id, connection)

        if not self.first_to_shoot:
            self.first_to_shoot = player_id

    def reset_salvo_shots(self):
        self.salvo_shots_remaining = 3

    @property
    def started(self) -> bool:
        return self._started

    def start_battle(self):
        self.turn_player_id = self.first_to_shoot
        self._started = True

    @property
    def ended(self) -> bool:
        return self._ended

    def end_battle(self):
        self._ended = True

    @property
    def running(self) -> bool:
        return self.started and not self.ended

    def get_game_state(self, player_id: UUID) -> GameServerStateMessage:
        player_connection = self.players[player_id]
        opponent_connection = self.get_opponent_connection(
            player_id,
            raise_on_missing="Trying to get game state even though opponent has NEVER INITIALLY connected.",
        )

        return GameServerStateMessage(
            own_grid=player_connection.ship_grid.get_own_view(),
            opponent_grid=opponent_connection.ship_grid.get_opponent_view(),
        )

    def swap_turn(self):
        if not self.turn_player_id:
            self.turn_player_id = self.first_to_shoot
        else:
            next_turn_player_id = self.get_opponent_id(
                self.turn_player_id,
                raise_on_missing="Cannot swap turn, next turn player not in game.",
            )
            self.turn_player_id = next_turn_player_id
