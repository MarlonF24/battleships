import asyncio

from fastapi import WebSocket, WebSocketException

from backend.logger import logger

from ....db import session_mkr
from ...model import PregameServerMessage, PregamePlayerSetReadyStateMessage, PregamePlayerMessage
from ...relations import Game, GamePhase, Player, Ship as DBShip, Orientation as DBOrientation
from ..conn_manager import *
from .connection import PregameGameConnections, PregamePlayerConnection




class PregameConnectionManager(ConnectionManager[PregameGameConnections, PregamePlayerConnection, PregameServerMessage, PregamePlayerMessage]):
    

    async def allow_connection(self, game: Game, player: Player, websocket: WebSocket) -> WebSocketException | PregameGameConnections:
        if game.phase != GamePhase.PREGAME:
            return WebSocketException(code=status.WS_1008_POLICY_VIOLATION, reason=f"Cannot connect to WebSocket for game {game.id} which is not in PREGAME phase but {game.phase}.")
        else:
            return PregameGameConnections()


    async def add_player_connection(self, game: Game, player: Player, websocket: WebSocket):
        self.active_connections[game.id].add_player(player.id, PregamePlayerConnection(websocket=websocket))
        

    async def start_up(self, game: Game, player: Player, websocket: WebSocket):
        await super().start_up(game, player, websocket)

        # initial send of current ready count
        game_connection = self.get_game_connections(game)

        await self.send_personal_message(game, player, PregameServerMessage(ready_state=game_connection.get_ready_state(player.id)))

    async def clean_up(self, game: Game, player: Player, wse: WebSocketException | None = None):
        if game_conns := self.get_game_connections(game, raise_on_missing=False):

            if game_conns.num_initially_connected() <= 1:
                logger.info(f"Only initially connected player {player.id} disconnected from pregame of game {game.id} before a second player joined. Closing game connections and deleting game from DB.")

                await self.delete_game_from_db(game)

                asyncio.create_task(self.close_player_connections(game, reason="A player disconnected before both players were ready.", remove_game_connection=True))


            return await super().clean_up(game, player, wse)
        else:
            logger.warning(f"Tried to clean up connection for player {player.id} in game {game.id}, but no game connections found. Maybe it was already removed earlier? Check whether this was intended.")


    async def handle_type_messages(self, game: Game, player: Player, message_queue: asyncio.Queue[PregamePlayerMessage]):

        player_ready_queue: asyncio.Queue[PregamePlayerSetReadyStateMessage] = asyncio.Queue()

        async with asyncio.TaskGroup() as tg:
            tg.create_task(
                self.type_player_message_router(
                    game, player, message_queue, player_ready_queue
                    ), 
                    name="pregame_message_type_router"
                )
            tg.create_task(
                self.player_ready_message_consumer(
                    game, player, player_ready_queue
                    ), 
                    name="pregame_ready_consumer"
                )



    async def type_player_message_router(self, game: Game, player: Player, input_queue: asyncio.Queue[PlayerMessageType], ready_message_queue: asyncio.Queue[PregamePlayerSetReadyStateMessage]):
        
        async with self.router_lifecycle(game, player, input_queue, {ready_message_queue}):
            
            game_connection = self.get_game_connections(game)
            
            # Note: we only expect one message here, the ready state, but we keep the pattern consistent for scalability
            async for message in self.message_generator(input_queue):
                if game_connection.num_ready_players() == 2:
                    logger.warning(f"Received message after both players were ready in game {game.id}. This message was likely sent exactly between the handle_player_ready_message noticing the 2 ready players and the sockets closing. Ignoring message: {message}")
                    break 



                logger.info(f"Trying to read message as PregamePlayerMessage in game {game.id} from player {player.id}")

                _, payload = betterproto.which_one_of(message, "payload")

                match payload:
                    case PregamePlayerSetReadyStateMessage() as message:
                        await ready_message_queue.put(message)
                    case _:
                        logger.error(f"Unknown message payload received in PregamePlayerMessage {game.id}: {message}")
                        raise WebSocketException(code=status.WS_1002_PROTOCOL_ERROR, reason="Unknown message payload in PregamePlayerMessage.")
                



    async def player_ready_message_consumer(self, game: Game, player: Player, message_queue: asyncio.Queue[PregamePlayerSetReadyStateMessage]):
        player_connection = self.get_player_connection(game, player)

        async for message in self.message_generator(message_queue):
            if player_connection.ready:
                logger.warning(f"Received ready message from player {player.id} in game {game.id} after they were already marked ready. Ignoring message: {message}")
        
            
            # Note: technically we dont need background task here as we expect to do this once, but for consistency with other handlers we use it
            self.create_background_task(self.handle_player_ready_message(game, player, message), name=f"handle_pregame_ready_message_game_{game.id}_player_{player.id}")



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
            

            await self.broadcast(game, sender=None, message=lambda pid: PregameServerMessage(ready_state=game_conns.get_ready_state(pid)), raise_on_closed_socket=None)


            if game_conns.num_ready_players() == 2:
                # both players are ready, end pregame
                game = await session.get_one(Game, game.id)
                game.phase = GamePhase.GAME
                session.add(game)
                
                # if both ready commit already before running any further logic
                await session.commit()

                logger.info(f"Pregame ended for game {game.id}, phase set to GAME")

                await self.close_player_connections(game, reason="Pregame completed.", remove_game_connection=True)
    
 

        

conn_manager = PregameConnectionManager()

if __name__ == "__main__":
    pass