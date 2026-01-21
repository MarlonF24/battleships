import betterproto, asyncio
from collections.abc import AsyncGenerator, Coroutine
from contextlib import asynccontextmanager
from uuid import UUID
from typing import Generic, Literal, TypeVar, Any, Callable, overload
from abc import ABC, abstractmethod
from fastapi import WebSocket, WebSocketException, websockets, status
from unittest.mock import patch


from backend.logger import logger

from ...db import session_mkr
from ..model import GamePlayerMessage, GeneralPlayerMessage, PregameServerMessage, GameServerMessage, ServerOpponentConnectionMessage, PlayerMessage, ServerMessage, GeneralServerMessage, PregamePlayerMessage
from ..relations import Game, Player

from .connection import PlayerConnectionType, GameConnectionsType


    


ServerMessageType = TypeVar('ServerMessageType', PregameServerMessage, GameServerMessage)
PlayerMessageType = TypeVar('PlayerMessageType', PregamePlayerMessage, GamePlayerMessage)

class ConnectionManager(ABC, Generic[GameConnectionsType, PlayerConnectionType, ServerMessageType, PlayerMessageType]):
    type MessageFactory = Callable[[UUID], ServerMessageType]

    def __init__(self):
        self.active_connections: dict[UUID, GameConnectionsType] = {} 
        self.server_message_payload_map: dict[type, str] = {
            field_type : field_name for field_name, field_type in ServerMessage._betterproto.cls_by_field.items() # type: ignore
        }
        self.background_tasks: set[asyncio.Task[Any]] = set()

    def create_background_task(self, coro: Coroutine[Any, Any, Any], name: str, task_to_crash_along: asyncio.Task[Any] | None = None) -> None:
        """
        Let a coroutine be executed in the global event loop as a background task, by being stored in the connection manager's background tasks set garbage collection is prevented. If the parent task is still running when the background task crashes, the parent task is cancelled as well.
        
        Args:
            coro: The coroutine to execute as a background task.
            task_to_crash_along: The parent task that wants to schedule the coro.
        """

        task = asyncio.create_task(coro, name=name)
        self.background_tasks.add(task)

        def task_done_callback(t: asyncio.Task[Any]):
            self.background_tasks.discard(t)
            
            try:
                if exc := t.exception():
                    logger.error(f"Background task {t.get_name()} CRASHED: {exc}", exc_info=exc)
                    
                    if task_to_crash_along and not task_to_crash_along.done():
                        logger.critical(f"Killing parent consumer {task_to_crash_along.get_name()} due to background failure.")
                        
                        # kill parent consumer
                        task_to_crash_along.cancel() 
                        
            # raised by .exception() if the task was cancelled
            except asyncio.CancelledError:
                logger.info(f"Background task {t.get_name()} was cancelled.")
            
        task.add_done_callback(task_done_callback)
     

    @overload
    def get_game_connections(self, game: Game, raise_on_missing: Literal[True] = True) -> GameConnectionsType: ...
    @overload
    def get_game_connections(self, game: Game, raise_on_missing: Literal[False]) -> GameConnectionsType | None: ...
    def get_game_connections(self, game: Game, raise_on_missing: bool = True) -> GameConnectionsType | None:
        game_conns = self.active_connections.get(game.id)
        if not game_conns and raise_on_missing:
            raise ValueError("Game connections not found.")
        return game_conns


    @overload
    def get_player_connection(self, game: Game, player: Player, raise_on_missing: Literal[True] = True) -> PlayerConnectionType: ...
    @overload
    def get_player_connection(self, game: Game, player: Player, raise_on_missing: Literal[False]) -> PlayerConnectionType | None: ...
    def get_player_connection(self, game: Game, player: Player, raise_on_missing: bool = True) -> PlayerConnectionType | None:
        game_conns = self.get_game_connections(game, raise_on_missing=raise_on_missing)
        
        if game_conns:
            player_con = game_conns.players.get(player.id)
            if not player_con and raise_on_missing:
                raise ValueError("Player connection not found.")
            return player_con
        else:
            return None
    

    @abstractmethod
    async def add_player_connection(self, game: Game, player: Player, websocket: WebSocket):
        """Add a player's connection to the active connections for a game."""
        ...

    @abstractmethod 
    async def allow_connection(self, game: Game, player: Player, websocket: WebSocket) -> WebSocketException | GameConnectionsType :
        """
        Check whether the player is allowed to connect to the game. If yes, return a GameConnectionsType, otherwise a WebSocketException.
        """
        ...
    
    async def connect(self, game: Game, player: Player, websocket: WebSocket):
        """Handle the connection process for a player in a game. First checks if connection is allowed based on a method, then accepts the websocket and adds the player connection to the active connections."""
        
        res = await self.allow_connection(game, player, websocket)
        
        if isinstance(res, WebSocketException):
            logger.info(f"Connection not allowed for game {game.id}, player {player.id}: {res.reason}")
            raise res
        
        if game.id not in self.active_connections:
            self.active_connections[game.id] = res
            logger.info(f"Created new GameConnections for game {game.id}")


        await websocket.accept() 


        logger.info(f"WebSocket connection accepted for game {game.id}, player {player.id}")
        await self.add_player_connection(game, player, websocket)
       


    async def disconnect(self, game: Game, player: Player, code: int = status.WS_1000_NORMAL_CLOSURE, reason: str = "Normal Closure"):
        """
        Close a player's websocket if he is still in the local datastructures.
        
        Args:
            code: The WebSocket close code to use.
            reason: The reason for the WebSocket closure.
        """

        if player_conn := self.get_player_connection(game, player, raise_on_missing=False):
            try:
                await player_conn.websocket.close(code=code, reason=reason) 
                logger.info(f"WebSocket connection closed for game {game.id}, player {player.id}")
            except Exception as e:
                logger.warning(f"Error closing WebSocket for game {game.id}, player {player.id}. Likely harmless as the socket might already be closed: {e}")
        else:
            logger.warning(f"Trying to disconnect Player {player.id} in game {game.id}, cannot find websocket. Either never connected or already removed from the Mappings in either the connection manager or the game connections for {game.id}. Check whether that is intended.")
    


    async def close_player_connections(self, game: Game, reason: str, remove_game_connection: bool = False):
        """Close all player connections in a game and remove the game from active connections."""
        game_conns = self.get_game_connections(game)

        await asyncio.gather(*(self.disconnect(game, Player(id=player_id), reason=reason) for player_id in game_conns.players))
        
        if remove_game_connection:
            del self.active_connections[game.id]

    async def delete_game_from_db(self, game: Game, raise_on_missing: bool = True):
        """Delete a game from the database."""
        async with session_mkr.begin() as session:
            _game = await session.get(Game, game.id)
            
            if not _game and raise_on_missing:
                raise ValueError(f"Game {game.id} not found in database for deletion.")
            elif _game:
                await session.delete(_game)
        
        logger.info(f"Deleted game {game.id} from database.")

    async def send_server_message(self, websocket: WebSocket, message: ServerMessageType | GeneralServerMessage, raise_on_closed_socket: str | None = "Attempted to send message on closed WebSocket."):
        """
        Send a server message over the websocket. Wraps the message into the appropriate envelope.
        Args:
            raise_on_closed_socket: If set, raises a WebSocketException with this reason when the socket is closed.
        """
        try:
            message = ServerMessage(**{self.server_message_payload_map[type(message)]: message}) # type: ignore

            await websocket.send_bytes(bytes(message))
        
        except RuntimeError:
            if raise_on_closed_socket:
                raise WebSocketException(code=status.WS_1008_POLICY_VIOLATION, reason=raise_on_closed_socket)
        

    async def broadcast(
        self, game: Game, sender: Player | None, 
        message: ServerMessageType | GeneralServerMessage | MessageFactory, only_opponent: bool = False, raise_on_closed_socket: str | None = "Attempted to broadcast message but one of the desired recipients has a closed WebSocket."
    ):

        """Broadcast a message to all players in a game, optionally excluding the sender."""

        if not sender and only_opponent:
            raise ValueError("Cannot broadcast only to opponent when sender is None.")
        
        coroutines: list[Coroutine[Any, Any, None]] = []

        for player_id, connection in self.get_game_connections(game):        
            if only_opponent and sender is not None and player_id == sender.id:
                continue

            if callable(message):
                message_instance = message(player_id)
            else:
                message_instance = message
    
            
            if connection.websocket.client_state != websockets.WebSocketState.CONNECTED and raise_on_closed_socket is not None:
                raise WebSocketException(code=status.WS_1008_POLICY_VIOLATION, reason=raise_on_closed_socket)
            else:
                coroutines.append(self.send_server_message(connection.websocket, message_instance))

        if not raise_on_closed_socket:
            await asyncio.gather(*coroutines, return_exceptions=True) # return exceptions to avoid cancelling
        
        else:
            try:
                # Using a TaskGroup to cancel on first failure
                async with asyncio.TaskGroup() as tg:
                    for coroutine in coroutines:
                        tg.create_task(coroutine)

            except* WebSocketException as wse:
                raise WebSocketException(code=status.WS_1008_POLICY_VIOLATION, reason="One or more WebSocketExceptions raised during broadcast.") from wse



    async def send_personal_message(self, game: Game, player: Player, message: ServerMessageType | GeneralServerMessage, raise_on_closed_socket: str | None = "Tried to send personal message on closed WebSocket."):    
        """
        Send a personal message to a specific player in a game. Mainly meant for the player who ultimately initialised this call.
        
        Args:
            raise_on_closed_socket: If set, raises a WebSocketException with this reason when the socket is closed.
        """    
        
        player_connection = self.get_player_connection(game, player)
        
        await self.send_server_message(player_connection.websocket, message, raise_on_closed_socket=raise_on_closed_socket)


    async def inform_opponent_about_own_connection_if_present(self, game: Game, sender: Player):
        """Notify the opponent about the sender's connection status. If no opponent is connected, does nothing."""
        if game_conns := self.get_game_connections(game, raise_on_missing=False):
            
            message = game_conns.get_connection_message(sender.id)
            
            await self.broadcast(game, sender, message, only_opponent=True, raise_on_closed_socket=None) 
            
            logger.info(f"Informed opponent of player {sender.id} in game {game.id} about connection status.")


    async def inform_self_about_opponent_connection(self, game: Game, player: Player):
        """Notify the player about the opponent's connection status."""
        
        game_conns = self.get_game_connections(game)
        
        if opponent := game_conns.get_opponent_id(player.id, raise_on_missing=None):
            message = game_conns.get_connection_message(opponent)
        else:
            message = GeneralServerMessage(opponent_connection_message=ServerOpponentConnectionMessage(
                opponent_connected=False,
                initially_connected=False
            ))
            
        await self.send_personal_message(game, player, message) # type: ignore
        logger.info(f"Informed player {player.id} in game {game.id} about opponent's connection status.")



    async def start_up(self, game: Game, player: Player, websocket: WebSocket):
        """
        Start up the websocket connection lifecycle for a player in a game.

        Args:
            game: The game instance associated with the websocket connection
            player: The player instance associated with the websocket connection
            websocket: The FastAPI WebSocket instance
        """
        await self.connect(game, player, websocket)
        await asyncio.gather(
            self.inform_opponent_about_own_connection_if_present(game, player),
            self.inform_self_about_opponent_connection(game, player)
            )
  

    async def clean_up(self, game: Game, player: Player, wse: WebSocketException | None = None):
        """
        Clean up after websocket connection ends, inform opponent and disconnect websocket.

        Args:
            game: The game instance associated with the websocket connection
            player: The player instance associated with the websocket connection
            wse: The WebSocketException instance to send in the closure if one occurred. Defaults to None.
        """
        if game.id in self.active_connections:
            logger.info(f"Cleaning up connection for game {game.id}, player {player.id}...")
            await self.inform_opponent_about_own_connection_if_present(game, player)
            if wse:
                code = wse.code
                reason = wse.reason
            else:
                code = status.WS_1000_NORMAL_CLOSURE
                reason = "Normal Closure"
                
            await self.disconnect(game, player, code=code, reason=reason)

        logger.warning(f"Tried to clean up connection for game {game.id}, player {player.id} but no active connection found. Either it has already been removed or was never established. Please check whether this is intended.")



    @asynccontextmanager
    async def websocket_lifecycle(self, game: Game, player: Player, websocket: WebSocket):
        """
        Context manager handling the full lifecycle of a websocket connection for a player in a game.

        Args:
            game: The game instance associated with the websocket connection
            player: The player instance associated with the websocket connection
            websocket: The FastAPI WebSocket instance

        Yields:
            The two message queues, general messages and phase-specific messages.
        """
        
        wse: WebSocketException | None = None

        try:
            logger.info(f"Starting WebSocket lifecycle for game {game.id}, player {player.id}")
            await self.start_up(game, player, websocket)
            
            
            yield


       
        except WebSocketException as e:
            wse = e
            logger.info(f"WebSocketException caught in lifecycle for game {game.id}, player {player.id}: {e}")

        except Exception as e:
            wse = WebSocketException(code=status.WS_1011_INTERNAL_ERROR, reason="WebSocket closed due to internal error.")
            logger.error(f"Exception caught in lifecycle for game {game.id}, player {player.id}: {e}")
            logger.error("Traceback:", exc_info=True)

        finally:
            logger.info(f"Cleaning up WebSocket lifecycle for game {game.id}, player {player.id}")
            await self.clean_up(game, player, wse)



    async def handle_websocket(self, game: Game, player: Player, websocket: WebSocket):
        """
        Entry point for the FastAPI websocket endpoint

        Args:
            game: The game instance associated with the websocket connection
            player: The player instance associated with the websocket connection
            websocket: The FastAPI WebSocket instance

        Notes:
            If the connection is closed normally by the client or even the backend itself (Status 1000), the generator in the producer will exhaust, the producer will let the queues drain out and then shut them down, causing the consumers to finish as well.
            If an exception propagates in a consumer, the whole TaskGroup will be cancelled, including the producer. Then the lifecycle's cleanup will be executed with will close possibly open connections.

        """
        
        async with self.websocket_lifecycle(game, player, websocket):
            async with asyncio.TaskGroup() as tg:
                general_message_queue = asyncio.Queue[GeneralPlayerMessage](maxsize=10)
                message_type_queue = asyncio.Queue[PlayerMessageType](maxsize=10)

                tg.create_task(self.player_message_router(websocket, game, player, general_message_queue, message_type_queue))

                # tg.create_task(self.handle_general_messages(game, player, websocket, general_message_queue))

                tg.create_task(self.handle_type_messages(game, player, message_type_queue))


    
    @asynccontextmanager
    async def router_lifecycle(self, game: Game, player: Player, input_queue: asyncio.Queue[Any] | Literal["Websocket"], output_queues: set[asyncio.Queue[Any]]) :
        try:
        
            yield 

        
        except Exception as e:
            logger.error(f"Exception raised in message producer for {output_queues} from {input_queue} for game {game.id}, player {player.id}: {e}")
        
        finally:
            
            # check if the current task was cancelled by a consumer (to avoid deadlocks)
            if current_task := asyncio.current_task():
                if current_task.cancelled():
                    logger.info(f"Message producer was cancelled (Likely due to a consumer in the task group crashing). Exiting immediately without draining queues.")

                    for queue in output_queues:
                        queue.shutdown()
                    
                    return

            # normal websocket closure or exception in producer
            # wait for consumers to finish
            logger.info(f"Producer was not cancelled. Draining and then shutting down message queues...")
            
            await asyncio.gather(*(self.drain_and_shutdown_queue(queue) for queue in output_queues))
    


    async def drain_and_shutdown_queue(self, queue: asyncio.Queue[Any]):
        # wait till consumers have processed all messages
        await queue.join()
        # then shut down the queue to stop the generator for the consumers for them to finish
        queue.shutdown()
    


    async def player_message_router(self, websocket: WebSocket, game: Game, player: Player, general_queue: asyncio.Queue[GeneralPlayerMessage], type_queue: asyncio.Queue[PlayerMessageType]):
        """
        Top-level message producer that reads messages from the websocket and enqueues them into the appropriate queues.

        Args:
            websocket: The FastAPI WebSocket instance
            game: The game instance associated with the websocket connection
            player: The player instance associated with the websocket connection
            general_queue: The queue for general player messages
            type_queue: The queue for phase-specific player messages

        Notes:
            This producer reads messages from the websocket and enqueues them into the appropriate queues based on their type.
            Upon socket closure, it ensures that the queues are drained and shut down properly to allow consumers to finish. Upon exception in the producer itself, the same cleanup is performed.
        """
        async with self.router_lifecycle(game, player, "Websocket", {general_queue, type_queue}):
            
            async for message in websocket.iter_bytes():
            
                # For some reason betterproto works like that Message().parse(bytes) but pydantic checks before we parse then, thus we circumvent validation like this:
                with patch.object(betterproto.Message, "_validate_field_groups", side_effect=lambda _: None): # type: ignore
                    message_obj = PlayerMessage() 
                    message_obj.parse(message)

                logger.info(f"Received WebSocket message in game {game.id} from player {player.id}")


                _, payload = betterproto.which_one_of(message_obj, "payload")


                match payload:
                    case GeneralPlayerMessage():
                        await general_queue.put(payload) 
                        logger.info(f"Enqueued GeneralPlayerMessage from player {player.id} in game {game.id} to general queue: {payload}")

                    case _:
                        await type_queue.put(payload) # type: ignore
                        logger.info(f"Enqueued PlayerMessage from player {player.id} in game {game.id} to phase-specific queue: {payload}")
        
        

    T = TypeVar('T')

    @staticmethod
    async def message_generator(queue: asyncio.Queue[T]) -> AsyncGenerator[T, None]:
        while True:
            try:
                message = await queue.get()
                yield message
                queue.task_done()

            except asyncio.QueueShutDown:
                return
   

    async def handle_general_messages(self, game: Game, player: Player, websocket: WebSocket, general_queue: asyncio.Queue[GeneralPlayerMessage]):
        pass

    @abstractmethod
    async def handle_type_messages(self, game: Game, player: Player, message_queue: asyncio.Queue[PlayerMessageType]):
        ...

if __name__ == "__main__":
    pass


