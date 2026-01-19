import asyncio

from fastapi import WebSocket
from dataclasses import dataclass
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession

from backend.logger import logger

from ...db import session_mkr
from ..model import PregameServerMessage, PregamePlayerSetReadyStateMessage, PregameServerReadyStateMessage, PregamePlayerMessage
from ..relations import Game, GamePhase, Player, Ship as DBShip, Orientation as DBOrientation
from .conn_manager import *


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


class PregameConnectionManager(ConnectionManager[PregameGameConnections, PregamePlayerConnection, PregameServerMessage, PregamePlayerMessage]):
    

    async def allow_connection(self, game: Game, player: Player, websocket: WebSocket, session: AsyncSession) -> WebSocketException | PregameGameConnections:
        if game.phase != GamePhase.PREGAME:
            return WebSocketException(code=status.WS_1008_POLICY_VIOLATION, reason=f"Cannot connect to WebSocket for game {game.id} which is not in PREGAME phase but {game.phase}.")
        else:
            return PregameGameConnections()


    async def add_player_connection(self, game: Game, player: Player, websocket: WebSocket, session: AsyncSession):
        self.active_connections[game.id].add_player(player.id, PregamePlayerConnection(websocket=websocket))
        

    async def broadcast_ready_state(self, game: Game):
        game_conns = self.get_game_connections(game)    
        
        await self.broadcast(game, sender=None, message=lambda pid: PregameServerMessage(ready_state=game_conns.get_ready_state(pid)))
        


    async def start_up(self, game: Game, player: Player, websocket: WebSocket, session: AsyncSession):
        await super().start_up(game, player, websocket, session)

        # initial send of current ready count
        game_connection = self.get_game_connections(game)

        await self.send_personal_message(game, player, PregameServerMessage(ready_state=game_connection.get_ready_state(player.id)))

    
    async def type_message_consumer(self, game: Game, player: Player, session: AsyncSession, message_queue: asyncio.Queue[PlayerMessageType]):
        
        # initial send of current ready count
        game_connection = self.get_game_connections(game)
        

        async for message in self.message_generator(message_queue):
            
            if game_connection.num_ready_players() == 2:
                logger.warning(f"Received message after both players were ready in game {game.id}. This message was likely sent exactly between the handle_player_ready_message noticing the 2 ready players and the sockets closing. Ignoring message: {message}")
                break  
            
              
            logger.info(f"Trying to read message as PregamePlayerMessage in game {game.id} from player {player.id}")
            
            _, payload = betterproto.which_one_of(message, "payload")


            match payload:
                case PregamePlayerSetReadyStateMessage() as message:
                    logger.info(f"Received PregamePlayerSetReadyStateMessage from player {player.id} in game {game.id}: {message}")
                    # execute the handler in the global event loop to make sure it executes fully even if the consumer is cancelled
                    self.create_background_task(self.handle_player_ready_message(game, player, message))

                case _:
                    logger.error(f"Unknown message payload received in PregamePlayerMessage {game.id}: {message}")
                    raise WebSocketException(code=status.WS_1002_PROTOCOL_ERROR, reason="Unknown message payload in PregamePlayerMessage.")
              
                

    async def handle_player_ready_message(self, game: Game, player: Player, message: PregamePlayerSetReadyStateMessage):
        # Use a new session for DB operations in this handler as this is run via create_task in the main event loop
        # if something cancels the consumer that called this handler, the session will be kept alive independently
        async with session_mkr.begin() as session:
            
            game_conns = self.get_game_connections(game)
            player_conn = game_conns.players[player.id]
            
            # update readiness state
            player_conn.ready = True
            
            ships = [DBShip(game_id=game.id, player_id=player.id, length=ship.length, head_row=ship.head_row, head_col=ship.head_col, orientation=DBOrientation(ship.orientation)) for ship in message.ships]

            session.add_all(ships)
            

            await self.broadcast_ready_state(game)


            if game_conns.num_ready_players() == 2:
                # both players are ready, end pregame
                game = await session.merge(game)  # re-attach game to session
                game.phase = GamePhase.GAME
                session.add(game)
                
                # if both ready commit already before running any further logic
                await session.commit()

                logger.info(f"Pregame ended for game {game.id}, phase set to GAME")

                await self.close_and_remove_game_connections(game)
    
 

        

conn_manager = PregameConnectionManager()

if __name__ == "__main__":
    pass