from fastapi import WebSocket
from dataclasses import dataclass, field
from uuid import UUID
from collections import defaultdict
from sqlalchemy.ext.asyncio import AsyncSession

from backend.logger import logger

from .conn_manager import *

from ..model import PregameServerMessage, PregamePlayerSetReadyStateMessage, PregameServerReadyStateMessage, PregamePlayerMessage

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

    def get_ready_state(self, player_id: UUID) -> PregameServerReadyStateMessage:
        return PregameServerReadyStateMessage(
            num_ready_players=self.num_ready_players(),
            self_ready=self.players[player_id].ready
        )


class PregameConnectionManager(ConnectionManager[PregameGameConnections, PregamePlayerConnection, PregameServerMessage]):
    def __init__(self):
            super().__init__()
            self.active_connections: dict[UUID, PregameGameConnections] = defaultdict(PregameGameConnections)


    async def connect(self, game: Game, player: Player, websocket: WebSocket, session: AsyncSession):
        self.active_connections[game.id].add_player(player.id, PregamePlayerConnection(websocket=websocket))
        
        await super().connect(game, player, websocket, session=session)  # session is not used in this context


    async def end_pregame(self, game: Game, session: AsyncSession):
        game.phase = GamePhase.GAME
        session.add(game)
        await session.commit()
        
        del self.active_connections[game.id]

        logger.info(f"Pregame ended for game {game.id}, phase set to GAME")
        
        await self.broadcast_ready_state(game)  # Notify players that pregame has ended
        logger.info(f"Broadcasted that both players are ready in game {game.id}")



    async def broadcast_ready_state(self, game: Game):
        game_conns = self.get_game_connections(game)    
        
        await self.broadcast(game, sender=None, message=lambda pid: PregameServerMessage(ready_state=game_conns.get_ready_state(pid)))
        

    async def _handle_websocket(self, game: Game, player: Player, websocket: WebSocket, session: AsyncSession):
        
        # initial send of current ready count
        game_connection = self.get_game_connections(game)
        
        await self.send_personal_message(game, player, PregameServerMessage(ready_state=game_connection.get_ready_state(player.id)))

        both_ready = False

        async for message in self.message_generator(websocket, game, player):
            
            if both_ready:
                logger.warning(f"Received message after both players were ready in game {game.id}. Ignoring message: {message}")
                continue    
                

            match message:
                case PregamePlayerMessage() as message:    
                    _, payload = betterproto.which_one_of(message, "payload")

                    match payload:
                        case PregamePlayerSetReadyStateMessage() as message:
                            await self.handle_player_ready_message(game, player, message, session)

                            if game_connection.num_ready_players() == 2:
                                logger.info(f"Both players ready in game {game.id}.")
                                await self.end_pregame(game, session)

                        case _:
                            logger.warning(f"Unknown message payload received in PregamePlayerMessage {game.id}: {message}")
                
                case _:
                    logger.warning(f"Non-PregamePlayerMessage type received in pregame {game.id}: {message}")
                
                

    async def handle_player_ready_message(self, game: Game, player: Player, message: PregamePlayerSetReadyStateMessage, session: AsyncSession):
        player_conn = self.get_player_connection(game, player)
        
        # update readiness state
        player_conn.ready = True
        
        ships = [DBShip(game_id=game.id, player_id=player.id, length=ship.length, head_row=ship.head_row, head_col=ship.head_col, orientation=ship.orientation) for ship in message.ships]

        session.add_all(ships)
        
        await session.commit()

        # broadcast updated ready count to both players
        await self.broadcast_ready_state(game)


    

conn_manager = PregameConnectionManager()

if __name__ == "__main__":
    pass