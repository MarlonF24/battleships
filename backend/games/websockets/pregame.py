from fastapi import WebSocket, WebSocketException, status
from dataclasses import dataclass, field
from uuid import UUID
from collections import defaultdict
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import ValidationError

from backend.logging import logger

from .conn_manager import *

from ..model import PregameWSServerStateMessage, PregameWSServerMessage, PregameWSPlayerReadyMessage, WSServerOpponentConnectionMessage

from ..relations import Game, GamePhase, Player, Ship as DBShip

@dataclass
class PregamePlayerConnection(PlayerConnection):
    websocket: WebSocket
    ready: bool = False

@dataclass
class PregameGameConnections(GameConnections[PregamePlayerConnection]):
    players: dict[UUID, PregamePlayerConnection] = field(default_factory=dict) # type: ignore
    

    def add_player(self, player_id: UUID, connection: PregamePlayerConnection):
        super().add_player(player_id, connection)

        if player_id not in self.players:
            self.players[player_id] = PregamePlayerConnection(websocket=connection.websocket)
        else:
            self.players[player_id].websocket = connection.websocket


    def num_ready_players(self) -> int:
        return sum(1 for conn in self.players.values() if conn.ready)

    def get_pregame_state(self, player_id: UUID) -> PregameWSServerStateMessage:
        return PregameWSServerStateMessage(
            num_players_ready=self.num_ready_players(),
            self_ready=self.players[player_id].ready
        )

class PregameConnectionManager(ConnectionManager[PregameGameConnections, PregamePlayerConnection, PregameWSServerMessage]):
    def __init__(self):
            self.active_connections: dict[UUID, PregameGameConnections] = defaultdict(PregameGameConnections)


    async def connect(self, game: Game, player: Player, websocket: WebSocket, session: AsyncSession):
        self.active_connections[game.id].add_player(player.id, PregamePlayerConnection(websocket=websocket))
        
        await super().connect(game, player, websocket, session=session)  # session is not used in this context

    async def disconnect(self, game: Game, player: Player):
        if socket := self.get_player_connection(game, player): 
            await socket.websocket.close() # probably redundant as fastapi should do this automatically
            logger.info(f"WebSocket connection closed for game {game.id}, player {player.id}")
    

    async def end_pregame(self, game: Game, session: AsyncSession):
        if self.active_connections.get(game.id, None):
            # for player_id in game_conns.players.keys():
            #     await self.disconnect(game, Player(id=player_id))

            game.phase = GamePhase.GAME
            session.add(game)
            await session.commit()
            
            del self.active_connections[game.id]

            logger.info(f"Pregame ended for game {game.id}, phase set to GAME")

    async def broadcast_game_state(self, game: Game):
        game_conns = self.get_game_connections(game)    
        for player_id, connection in self.get_game_connections(game).players.items():        
            message = game_conns.get_pregame_state(player_id)
            await connection.websocket.send_json(message.model_dump())

    async def broadcast(self, game: Game, sender: Player, message: PregameWSServerMessage, only_opponent: bool = False):
        for player_id, connection in self.get_game_connections(game).players.items():        
            if only_opponent and player_id == sender.id:
                continue
            await connection.websocket.send_json(message.model_dump())

    async def handle_websocket(self, game: Game, player: Player, websocket: WebSocket, session: AsyncSession):
        await self.connect(game, player, websocket, session)

        try:
            # initial send of current ready count
            game_connection = self.get_game_connections(game)
            await websocket.send_json(game_connection.get_pregame_state(player.id).model_dump())

            async for message in websocket.iter_json():
                logger.info(f"Received WebSocket message: {message}")
                
                try:
                    message = PregameWSPlayerReadyMessage.model_validate(message)  
                
                    await self.handle_player_ready_message(game, player, message, session)

                    if game_connection.num_ready_players() == 2:
                        logger.info(f"Both players ready in game {game.id}.")
                        await self.end_pregame(game, session)
                        break 
                    

                except ValidationError:
                    message = WSServerOpponentConnectionMessage.model_validate(message)
                    
                    await self.handle_opponent_connected_message(game, player, message)
                

        finally:
            await self.disconnect(game, player)
            logger.info(f"WebSocket connection closed for game {game.id}, player {player.id}")



    async def handle_player_ready_message(self, game: Game, player: Player, message: PregameWSPlayerReadyMessage, session: AsyncSession):
        if not (player_conn := self.get_player_connection(game, player)):
            logger.error(f"Player connection not found for game {game.id}, player {player.id}")
            raise WebSocketException(code=status.WS_1008_POLICY_VIOLATION, reason="Player not connected")
        
        # update readiness state
        player_conn.ready = True
        
        ships = [DBShip(game_id=game.id, player_id=player.id, length=ship.length, head_row=ship.head_row, head_col=ship.head_col, orientation=ship.orientation) for ship in message.ships]

        session.add_all(ships)
        
        await session.commit()

        # broadcast updated ready count to both players
        await self.broadcast_game_state(game)

        
    async def handle_opponent_connected_message(self, game: Game, player: Player, message: WSServerOpponentConnectionMessage):
        await self.broadcast(game, player, message, only_opponent=True)

        logger.info(f"Informed opponend that Player {player.id} in game {game.id} has connected/disconnected.")

    

conn_manager = PregameConnectionManager()

