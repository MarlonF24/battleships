from uuid import UUID
import betterproto
from fastapi import WebSocket
from collections import defaultdict
from dataclasses import dataclass, field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from .conn_manager import *

from ..model import GameServerStateMessage, GameServerMessage, GamePlayerShotMessage, GamePlayerMessage, ShipGrid
from ..relations import Game, Ship


@dataclass
class GamePlayerConnection(PlayerConnection):
    ship_grid: ShipGrid

@dataclass
class GameGameConnections(GameConnections[GamePlayerConnection]):
    players: dict[UUID, GamePlayerConnection] = field(default_factory=dict) # type: ignore
    first_to_shoot: UUID | None = None
    started: bool = False

    def add_player(self, player_id: UUID, connection: GamePlayerConnection):
        super().add_player(player_id, connection)
        
        if player_id not in self.players:
            self.players[player_id] = connection
        else:
            self.players[player_id].websocket = connection.websocket


        if not self.first_to_shoot:
            self.first_to_shoot = player_id

    def get_game_state(self, player_id: UUID) -> GameServerStateMessage:
        player_connection = self.players[player_id]
        opponent_connection = next(
            conn for pid, conn in self.players.items() if pid != player_id
        )

        return GameServerStateMessage(
            own_grid=player_connection.ship_grid.get_own_view(),
            opponent_grid=opponent_connection.ship_grid.get_opponent_view(),
        )
    


class GameConnectionManager(ConnectionManager[GameGameConnections, GamePlayerConnection, GameServerMessage]):
    def __init__(self):
            super().__init__()
            self.active_connections: dict[UUID, GameGameConnections] = defaultdict(GameGameConnections)


    async def connect(self, game: Game, player: Player, websocket: WebSocket, session: AsyncSession):
        if self.get_player_connection(game, player):
            await self.disconnect(game, player)  # Disconnect existing connection for this user in the game
        
        ships = await session.scalars(
            select(Ship)
            .where(Ship.game_id == game.id) # type: ignore
            .where(Ship.player_id == player.id) # type: ignore
        )

        ships = set(ships.all())


        game_obj = await session.get_one(Game, game.id)

        player_connection = GamePlayerConnection(websocket=websocket, ship_grid=ShipGrid(ships=ships, rows=game_obj.battle_grid_rows, cols=game_obj.battle_grid_cols))
        
        self.active_connections[game.id].add_player(player.id, player_connection)
        
        await super().connect(game, player, websocket, session)



    async def _handle_websocket(self, game: Game, player: Player, websocket: WebSocket, session: AsyncSession):
        game_connections = self.get_game_connections(game)
        
        if not game_connections.started:
            both_curr_connected = False
            
            if opponent := game_connections.get_opponent_id(player.id):
                both_curr_connected = game_connections.currently_connected(opponent)

                if both_curr_connected:
                    logger.info(f"Both players already connected in game {game.id}.")
                    game_connections.started = True


        await self.send_personal_message(game, player, GameServerMessage(game_state=game_connections.get_game_state(player.id)))



        async for message in self.message_generator(websocket, game, player):
    
            message = GamePlayerMessage().parse(message)

            group, payload = betterproto.which_one_of(message, "payload")

            match payload:
                case GamePlayerShotMessage() as shot_msg:
                    pass
                case _:
                    logger.warning(f"Unhandled message type received in game {game.id}: ({group}) {payload}")
                    continue

            # player_conn.ship_grid.shoot_at()
                

conn_manager = GameConnectionManager()






