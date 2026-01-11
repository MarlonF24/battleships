from uuid import UUID
from fastapi import WebSocket, WebSocketException, status
from collections import defaultdict
from dataclasses import dataclass, field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import ValidationError

from .conn_manager import *

from ..model import GameWSServerStateMessage, GameWSServerMessage, GameWSPlayerShotMessage, WSServerOpponentConnectionMessage, ShipGrid
from ..relations import Game, Ship


@dataclass
class GamePlayerConnection(PlayerConnection):
    ship_grid: ShipGrid

@dataclass
class GameGameConnections(GameConnections[GamePlayerConnection]):
    players: dict[UUID, GamePlayerConnection] = field(default_factory=dict) # type: ignore
    first_to_shoot: UUID | None = None

    def add_player(self, player_id: UUID, connection: GamePlayerConnection):
        super().add_player(player_id, connection)
        
        if player_id not in self.players:
            self.players[player_id] = connection
        else:
            self.players[player_id].websocket = connection.websocket


        if not self.first_to_shoot:
            self.first_to_shoot = player_id

    def get_game_state(self, player_id: UUID) -> GameWSServerStateMessage:
        player_connection = self.players[player_id]
        opponent_connection = next(
            conn for pid, conn in self.players.items() if pid != player_id
        )

        return GameWSServerStateMessage(
            own_ship_grid=player_connection.ship_grid.get_own_view(),
            opponent_ship_grid=opponent_connection.ship_grid.get_opponent_view(),
        )
    


class GameConnectionManager(ConnectionManager[GameGameConnections, GamePlayerConnection, GameWSServerMessage]):
    def __init__(self):
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
        
        await websocket.accept()

        logger.info(f"WebSocket connection accepted for game {game.id}, player {player.id}")

        await super().connect(game, player, websocket, session)



    async def handle_websocket(self, game: Game, player: Player, websocket: WebSocket, session: AsyncSession):
        num_connected_before= len(self.get_game_connections(game).players)  
        
        
        await self.connect(game, player, websocket, session)

        both_connected = (num_connected_before == 1) # if, before adding this player, there was one player connected, this is the FIRST time both are connected -> start the game. (As we dont remove the players from the gameconnections on disconnect, a reconnect will not trigger this)

        try:
            game_connections = self.get_game_connections(game)
            await websocket.send_json(game_connections.get_game_state(player.id).model_dump())


            await self.broadcast(game, player, WSServerOpponentConnectionMessage(opponent_connected=True), only_opponent=True)
            logger.info(f"Informed opponend that Player {player.id} in game {game.id} has connected.")


            if both_connected:
                
                logger.info(f"Both players connected in game {game.id}.")

            await self.wait_for_both_players_connected(websocket)

            async for message in websocket.iter_json():
                logger.info(f"Received WebSocket message: {message}")
        
                message = GameWSPlayerShotMessage.model_validate(message)

                if not (player_conn := conn_manager.get_player_connection(game, player)): # type: ignore
                    logger.error(f"Player connection not found for game {game.id}, player {player.id}")
                    raise WebSocketException(code=status.WS_1008_POLICY_VIOLATION, reason="Player not connected")
                
                # player_conn.ship_grid.shoot_at()

        finally: # includes WebsocketDisconnection
            await self.broadcast(game, player, WSServerOpponentConnectionMessage(opponent_connected=False), only_opponent=True)
            logger.info(f"Informed opponend that Player {player.id} in game {game.id} has disconnected.")

            await conn_manager.disconnect(game, player)
            logger.info(f"WebSocket connection closed for game {game.id}, player {player.id}")



    async def wait_for_both_players_connected(self, websocket: WebSocket):
        async for message in websocket.iter_json():
            logger.info(f"Received WebSocket message: {message}")

            try:
                message = WSServerOpponentConnectionMessage.model_validate(message)
            except ValidationError as e:
                logger.error(f"Expected GameWSServerOpponentConnectionMessage, but received different message: {e}")
                continue

            if message.opponent_connected:
                return
                


conn_manager = GameConnectionManager()






