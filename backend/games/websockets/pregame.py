from fastapi import WebSocket
from dataclasses import dataclass
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession

from backend.logger import logger

from .conn_manager import *

from ..model import PregameServerMessage, PregamePlayerSetReadyStateMessage, PregameServerReadyStateMessage, PregamePlayerMessage

from ..relations import Game, GamePhase, Player, Ship as DBShip, Orientation as DBOrientation

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
    

    async def add_player_connection(self, game: Game, player: Player, websocket: WebSocket, session: AsyncSession):
        if game.id not in self.active_connections:
            self.active_connections[game.id] = PregameGameConnections()
            logger.info(f"Created new GameConnections for game {game.id}")

        self.active_connections[game.id].add_player(player.id, PregamePlayerConnection(websocket=websocket))
        


    async def end_pregame(self, game: Game, session: AsyncSession):
        game.phase = GamePhase.GAME
        session.add(game)
        await session.commit()


        logger.info(f"Pregame ended for game {game.id}, phase set to GAME")
        
        await self.broadcast_ready_state(game)  # Notify players that pregame has ended
        logger.info(f"Broadcasted that both players are ready in game {game.id}")



    async def broadcast_ready_state(self, game: Game):
        game_conns = self.get_game_connections(game)    
        
        await self.broadcast(game, sender=None, message=lambda pid: PregameServerMessage(ready_state=game_conns.get_ready_state(pid)))
        


    async def start_up(self, game: Game, player: Player, websocket: WebSocket, session: AsyncSession):
        await super().start_up(game, player, websocket, session)

        # initial send of current ready count
        game_connection = self.get_game_connections(game)

        await self.send_personal_message(game, player, PregameServerMessage(ready_state=game_connection.get_ready_state(player.id)))

    
    async def _handle_websocket(self, game: Game, player: Player, websocket: WebSocket, session: AsyncSession):
        
        # initial send of current ready count
        game_connection = self.get_game_connections(game)
        

        async for message in self.message_generator(websocket, game, player):
            
            if game_connection.num_ready_players() == 2:
                logger.warning(f"Received message after both players were ready in game {game.id}. Ignoring message: {message}")
                continue    
            
              
            logger.info(f"Trying to read message as PregamePlayerMessage in game {game.id} from player {player.id}")
            
            _, payload = betterproto.which_one_of(message, "payload")

            match payload:
                case PregamePlayerSetReadyStateMessage() as message:
                    logger.info(f"Received PregamePlayerSetReadyStateMessage from player {player.id} in game {game.id}: {message}")
                    await self.handle_player_ready_message(game, player, message, session)

                    if game_connection.num_ready_players() == 2:
                        logger.info(f"Both players ready in game {game.id}.")
                        await self.end_pregame(game, session)

                case _:
                    logger.error(f"Unknown message payload received in PregamePlayerMessage {game.id}: {message}")
                    raise WebSocketException(code=status.WS_1002_PROTOCOL_ERROR, reason="Unknown message payload in PregamePlayerMessage.")
              
                
    async def clean_up(self, game: Game, player: Player, websocket: WebSocket, session: AsyncSession):
        await super().clean_up(game, player, websocket, session)

        
        game_conns = self.get_game_connections(game)
        
        if game_conns.num_players() == 2:
            game_conns.remove_player(player.id)
            logger.info(f"Player {player.id} disconnected from pregame in game {game.id}")

            if not game_conns.players:
                del self.active_connections[game.id]
                logger.info(f"All players disconnected. Removed GameConnections for game {game.id}")    
                

    async def handle_player_ready_message(self, game: Game, player: Player, message: PregamePlayerSetReadyStateMessage, session: AsyncSession):
        player_conn = self.get_player_connection(game, player)
        
        # update readiness state
        player_conn.ready = True
        
        ships = [DBShip(game_id=game.id, player_id=player.id, length=ship.length, head_row=ship.head_row, head_col=ship.head_col, orientation=DBOrientation(ship.orientation)) for ship in message.ships]

        session.add_all(ships)
        
        await session.commit()
        # broadcast updated ready count to both players
        await self.broadcast_ready_state(game)


    

conn_manager = PregameConnectionManager()

if __name__ == "__main__":
    pass