import betterproto, asyncio, time
from collections.abc import AsyncGenerator, Coroutine
from contextlib import asynccontextmanager
from uuid import UUID
from typing import Generic, Literal, TypeVar, Any, Callable, overload
from abc import ABC, abstractmethod
from fastapi import WebSocket, WebSocketException, websockets, status
from unittest.mock import patch


from backend.logger import logger

from ...db import session_mkr
from ..model import (
    GamePlayerMessage,
    GeneralPlayerMessage,
    PregameServerMessage,
    GameServerMessage,
    ServerOpponentConnectionMessage,
    PlayerMessage,
    ServerMessage,
    GeneralServerMessage,
    PregamePlayerMessage,
    PlayerHeartbeatResponse,
    ServerHeartbeatRequest,
)
from ..relations import Game, Player

from .connection import PlayerConnectionType, GameConnectionsType


ServerMessageType = TypeVar(
    "ServerMessageType", PregameServerMessage, GameServerMessage
)
PlayerMessageType = TypeVar(
    "PlayerMessageType", PregamePlayerMessage, GamePlayerMessage
)


class ConnectionManager(
    ABC,
    Generic[
        GameConnectionsType, PlayerConnectionType, ServerMessageType, PlayerMessageType
    ],
):
    type MessageFactory = Callable[[UUID], ServerMessageType]

    def __init__(self):
        self.active_connections: dict[UUID, GameConnectionsType] = {}
        self.server_message_payload_map: dict[type, str] = {
            field_type: field_name for field_name, field_type in ServerMessage._betterproto.cls_by_field.items()  # type: ignore
        }
        self.background_tasks: set[asyncio.Task[Any]] = set()

        self.heartbeat_clock_task: asyncio.Task[None] | None = None

        from ..passive_cleaner import cleaner

        cleaner.add_connection_manager(self)

    def start_heartbeat_clock(self, interval: float = 30.0):
        if self.heartbeat_clock_task:
            logger.warning("Tried to start Heartbeat clock but it is already running.")
            return

        if not self.active_connections:
            logger.error(
                "Tried to start Heartbeat clock but there are no active connections. Aborting."
            )
            return

        self.heartbeat_clock_task = self.create_background_task(
            self.heartbeat_clock(interval=interval), name="heartbeat_clock"
        )
        logger.info("Heartbeat clock started.")

    def stop_heartbeat_clock(self):
        if not self.heartbeat_clock_task:
            logger.warning("Tried to stop Heartbeat clock but it is not running.")
            return

        if self.active_connections:
            logger.error(
                "Tried to stop Heartbeat clock but there are still active connections. Aborting."
            )
            return

        self.heartbeat_clock_task.cancel()
        self.heartbeat_clock_task = None
        logger.info("Heartbeat clock stopped.")

 
    def create_background_task[P](
        self,
        coro: Coroutine[Any, Any, P],
        name: str,
        task_to_crash_along: asyncio.Task[Any] | None = None,
    ) -> asyncio.Task[P]:
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
                    logger.error(
                        f"Background task {t.get_name()} CRASHED: {exc}", exc_info=exc
                    )

                    if task_to_crash_along and not task_to_crash_along.done():
                        logger.critical(
                            f"Killing parent consumer {task_to_crash_along.get_name()} due to background failure."
                        )
                        task_to_crash_along.cancel()

            except asyncio.CancelledError:
                logger.info(f"Background task {t.get_name()} was cancelled.")

        task.add_done_callback(task_done_callback)

        return task

    @overload
    def get_game_connections(
        self, game_id: UUID, raise_on_missing: Literal[True] = True
    ) -> GameConnectionsType: ...
    @overload
    def get_game_connections(
        self, game_id: UUID, raise_on_missing: Literal[False]
    ) -> GameConnectionsType | None: ...
    def get_game_connections(
        self, game_id: UUID, raise_on_missing: bool = True
    ) -> GameConnectionsType | None:
        game_conns = self.active_connections.get(game_id)
        if not game_conns and raise_on_missing:
            raise ValueError("Game connections not found.")
        return game_conns

    @overload
    def get_player_connection(
        self, game_id: UUID, player_id: UUID, raise_on_missing: Literal[True] = True
    ) -> PlayerConnectionType: ...
    @overload
    def get_player_connection(
        self, game_id: UUID, player_id: UUID, raise_on_missing: Literal[False]
    ) -> PlayerConnectionType | None: ...
    def get_player_connection(
        self, game_id: UUID, player_id: UUID, raise_on_missing: bool = True
    ) -> PlayerConnectionType | None:
        game_conns = self.get_game_connections(
            game_id, raise_on_missing=raise_on_missing
        )

        if game_conns:
            player_con = game_conns.players.get(player_id)
            if not player_con and raise_on_missing:
                raise ValueError("Player connection not found.")
            return player_con
        else:
            return None

    @abstractmethod
    async def add_player_connection(
        self, game: Game, player: Player, websocket: WebSocket
    ):
        """Add a player's connection to the active connections for a game."""
        ...

    @abstractmethod
    async def allow_connection(
        self, game: Game, player: Player, websocket: WebSocket
    ) -> WebSocketException | GameConnectionsType:
        """
        Check whether the player is allowed to connect to the game. If yes, return a GameConnectionsType, otherwise a WebSocketException.
        """
        ...

    async def connect(self, game: Game, player: Player, websocket: WebSocket):
        """Handle the connection process for a player in a game. First checks if connection is allowed based on a method, then accepts the websocket and adds the player connection to the active connections."""

        res = await self.allow_connection(game, player, websocket)

        if isinstance(res, WebSocketException):
            logger.info(
                f"Connection not allowed for game {game.id}, player {player.id}: {res.reason}"
            )
            raise res

        if game.id not in self.active_connections:
            self.active_connections[game.id] = res
            logger.info(f"Created new GameConnections for game {game.id}")

        await self.add_player_connection(game, player, websocket)

        await websocket.accept()
        logger.info(
            f"WebSocket connection accepted for game {game.id}, player {player.id}"
        )

    async def disconnect(
        self,
        game_id: UUID,
        player_id: UUID,
        code: int = status.WS_1000_NORMAL_CLOSURE,
        reason: str = "Normal Closure",
    ):
        """
        Close a player's websocket if he is still in the local datastructures.

        Args:
            code: The WebSocket close code to use.
            reason: The reason for the WebSocket closure.
        """

        if player_conn := self.get_player_connection(
            game_id, player_id, raise_on_missing=False
        ):
            try:
                await player_conn.websocket.close(code=code, reason=reason)
                logger.info(
                    f"WebSocket connection closed for game {game_id}, player {player_id}"
                )
            except Exception as e:
                logger.warning(
                    f"Error closing WebSocket for game {game_id}, player {player_id}. Likely harmless as the socket might already be closed: {e}"
                )
        else:
            logger.warning(
                f"Trying to disconnect Player {player_id} in game {game_id}, cannot find websocket. Either never connected or already removed from the Mappings in either the connection manager or the game connections for {game_id}. Check whether that is intended."
            )

    async def close_player_connections(
        self,
        game_id: UUID,
        reason: WebSocketException,
        remove_game_connection: bool = False,
    ):
        """Close all player connections in a game and optionally remove the game from active connections."""
        game_conns = self.get_game_connections(game_id)

        await asyncio.gather(
            *(
                self.disconnect(
                    game_id, player_id, code=reason.code, reason=reason.reason
                )
                for player_id in game_conns.players
            )
        )

        if remove_game_connection:
            del self.active_connections[game_id]

    async def delete_game_from_db(self, game_id: UUID, raise_on_missing: bool = True):
        """Delete a game from the database."""
        async with session_mkr.begin() as session:
            _game = await session.get(Game, game_id)

            if not _game and raise_on_missing:
                raise ValueError(f"Game {game_id} not found in database for deletion.")
            elif _game:
                await session.delete(_game)

        logger.info(f"Deleted game {game_id} from database.")

    async def send_server_message(
        self,
        websocket: WebSocket,
        message: ServerMessageType | GeneralServerMessage,
        raise_on_closed_socket: (
            str | None
        ) = "Attempted to send message on closed WebSocket.",
    ):
        """
        Send a server message over the websocket. Wraps the message into the appropriate envelope.
        Args:
            raise_on_closed_socket: If set, raises a WebSocketException with this reason when the socket is closed.
        """
        try:

            msg = ServerMessage(timestamp=int(time.time() * 1000), **{self.server_message_payload_map[type(message)]: message})  # type: ignore

            await websocket.send_bytes(bytes(msg))

        except RuntimeError as e:
            logger.debug(f"WebSocket runtime error when sending message: {e}")
            if raise_on_closed_socket:
                raise WebSocketException(
                    code=status.WS_1008_POLICY_VIOLATION, reason=raise_on_closed_socket
                )

    async def broadcast(
        self,
        game_id: UUID,
        sender_id: UUID | None,
        message: ServerMessageType | GeneralServerMessage | MessageFactory,
        only_opponent: bool = False,
        raise_on_closed_socket: (
            str | None
        ) = "Attempted to broadcast message but one of the desired recipients has a closed WebSocket.",
    ):
        """Broadcast a message to all players in a game, optionally excluding the sender."""

        if not sender_id and only_opponent:
            raise ValueError("Cannot broadcast only to opponent when sender is None.")

        coroutines: list[Coroutine[Any, Any, None]] = []

        for player_id, connection in self.get_game_connections(game_id):
            if only_opponent and sender_id is not None and player_id == sender_id:
                continue

            if callable(message):
                message_instance = message(player_id)
            else:
                message_instance = message

            if (
                connection.websocket.client_state != websockets.WebSocketState.CONNECTED
                and raise_on_closed_socket is not None
            ):
                raise WebSocketException(
                    code=status.WS_1008_POLICY_VIOLATION, reason=raise_on_closed_socket
                )
            else:
                coroutines.append(
                    self.send_server_message(connection.websocket, message_instance)
                )

        if not raise_on_closed_socket:
            await asyncio.gather(
                *coroutines, return_exceptions=True
            )  # return exceptions to avoid cancelling

        else:
            try:
                # Using a TaskGroup to cancel on first failure
                async with asyncio.TaskGroup() as tg:
                    for coroutine in coroutines:
                        tg.create_task(coroutine)

            except* WebSocketException as wse:
                raise WebSocketException(
                    code=status.WS_1008_POLICY_VIOLATION,
                    reason="One or more WebSocketExceptions raised during broadcast.",
                ) from wse

    async def send_personal_message(
        self,
        game_id: UUID,
        player_id: UUID,
        message: ServerMessageType | GeneralServerMessage,
        raise_on_closed_socket: (
            str | None
        ) = "Tried to send personal message on closed WebSocket.",
    ):
        """
        Send a personal message to a specific player in a game. Mainly meant for the player who ultimately initialised this call.

        Args:
            raise_on_closed_socket: If set, raises a WebSocketException with this reason when the socket is closed.
        """

        player_connection = self.get_player_connection(game_id, player_id)

        await self.send_server_message(
            player_connection.websocket,
            message,
            raise_on_closed_socket=raise_on_closed_socket,
        )

    async def inform_opponent_about_own_connection_if_present(
        self, game_id: UUID, sender_id: UUID
    ):
        """Notify the opponent about the sender's connection status. If no opponent is connected, does nothing."""
        if game_conns := self.get_game_connections(game_id, raise_on_missing=False):

            message = game_conns.get_connection_message(sender_id)

            await self.broadcast(
                game_id,
                sender_id,
                message,
                only_opponent=True,
                raise_on_closed_socket=None,
            )

            logger.info(
                f"Informed opponent of player {sender_id} in game {game_id} about connection status."
            )

    async def inform_self_about_opponent_connection(
        self, game_id: UUID, player_id: UUID
    ):
        """Notify the player about the opponent's connection status."""

        game_conns = self.get_game_connections(game_id)

        if opponent := game_conns.get_opponent_id(player_id, raise_on_missing=None):
            message = game_conns.get_connection_message(opponent)
        else:
            message = GeneralServerMessage(
                opponent_connection_message=ServerOpponentConnectionMessage(
                    opponent_connected=False, initially_connected=False
                )
            )

        await self.send_personal_message(game_id, player_id, message)  # type: ignore
        logger.info(
            f"Informed player {player_id} in game {game_id} about opponent's connection status."
        )

    async def start_up(self, game: Game, player: Player, websocket: WebSocket):
        """
        Start up the websocket connection lifecycle for a player in a game.

        Args:
            game: The game instance associated with the websocket connection
            player: The player instance associated with the websocket connection
            websocket: The FastAPI WebSocket instance
        """
        await self.connect(game, player, websocket)

        if not self.heartbeat_clock_task:
            self.start_heartbeat_clock()

        await asyncio.gather(
            self.inform_opponent_about_own_connection_if_present(game.id, player.id),
            self.inform_self_about_opponent_connection(game.id, player.id),
        )

    async def clean_up(
        self, game_id: UUID, player_id: UUID, wse: WebSocketException | None = None
    ):
        """
        Clean up after websocket connection ends, inform opponent and disconnect websocket.

        Args:
            game: The game instance associated with the websocket connection
            player: The player instance associated with the websocket connection
            wse: The WebSocketException instance to send in the closure if one occurred. Defaults to None.
        """
        player_conn = self.get_player_connection(
            game_id=game_id, player_id=player_id, raise_on_missing=False
        )

        if not player_conn:
            logger.warning(
                f"Tried to clean up connection for game {game_id}, player {player_id} but no active connection found. Either it has already been removed or was never established. Please check whether this is intended."
            )

        elif not player_conn.duplicate_connection_cleanup:
            logger.info(
                f"Cleaning up connection for game {game_id}, player {player_id}..."
            )
            await self.inform_opponent_about_own_connection_if_present(
                game_id, player_id
            )
            if wse:
                code = wse.code
                reason = wse.reason
            else:
                code = status.WS_1000_NORMAL_CLOSURE
                reason = "Normal Closure"

            await self.disconnect(game_id, player_id, code=code, reason=reason)

        else:
            player_conn.duplicate_connection_cleanup = (
                False  # reset flag for future connections
            )

        # If no active connections left, stop heartbeat clock. Technically we could only have closed sockets in all active connections. If that becomes an issue, we can loop over all websockets and check their state but might be overkill.
        if not self.active_connections:
            self.stop_heartbeat_clock()

    @asynccontextmanager
    async def websocket_lifecycle(
        self, game: Game, player: Player, websocket: WebSocket
    ):
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
            logger.info(
                f"Starting WebSocket lifecycle for game {game.id}, player {player.id}"
            )
            await self.start_up(game, player, websocket)

            yield

        except WebSocketException as e:
            wse = e
            logger.exception(
                f"WebSocketException caught in lifecycle for game {game.id}, player {player.id}: {e}"
            )

        except Exception as e:
            wse = WebSocketException(
                code=status.WS_1011_INTERNAL_ERROR,
                reason="WebSocket closed due to internal error.",
            )
            logger.exception(
                f"Exception caught in lifecycle for game {game.id}, player {player.id}: {e}"
            )
            
        finally:
            logger.info(
                f"Cleaning up WebSocket lifecycle for game {game.id}, player {player.id}"
            )
            await self.clean_up(game.id, player.id, wse)

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

                tg.create_task(
                    self.player_message_router(
                        websocket,
                        game.id,
                        player.id,
                        general_message_queue,
                        message_type_queue,
                    ),
                    name=f"PlayerMessageRouter-{game.id}-{player.id}"
                )

                tg.create_task(
                    self.handle_general_messages(
                        game.id, player.id, websocket, general_message_queue
                    ),
                    name=f"GeneralMessageHandler-{game.id}-{player.id}",
                )

                tg.create_task(
                    self.handle_type_messages(game.id, player.id, message_type_queue),
                    name=f"TypeMessageHandler-{game.id}-{player.id}",
                )

    @asynccontextmanager
    async def router_lifecycle(
        self,
        game_id: UUID,
        player_id: UUID,
        input_queue: asyncio.Queue[Any] | Literal["Websocket"],
        output_queues: set[asyncio.Queue[Any]],
    ):
        try:

            yield

        except Exception as e:
            logger.exception(
                f"Exception raised in message producer for {output_queues} from {input_queue} for game {game_id}, player {player_id}: {e}"
            )

        finally:

            # check if the current task was cancelled by a consumer (to avoid deadlocks)
            if current_task := asyncio.current_task():
                if current_task.cancelled():
                    logger.info(
                        f"Message producer {current_task.get_name()} in {game_id} for player {player_id} was cancelled (Likely due to a consumer in the task group crashing). Exiting immediately without draining queues."
                    )

                    for queue in output_queues:
                        queue.shutdown()

                    return

                # normal websocket closure or exception in producer
                # wait for consumers to finish
                logger.info(
                    f"Producer {current_task.get_name()} in {game_id} for player {player_id} was not cancelled. Draining and then shutting down message queues..."
                )

            await asyncio.gather(
                *(self.drain_and_shutdown_queue(queue) for queue in output_queues)
            )

    async def drain_and_shutdown_queue(self, queue: asyncio.Queue[Any]):
        # wait till consumers have processed all messages
        await queue.join()
        # then shut down the queue to stop the generator for the consumers for them to finish
        queue.shutdown()

    async def player_message_router(
        self,
        websocket: WebSocket,
        game_id: UUID,
        player_id: UUID,
        general_queue: asyncio.Queue[GeneralPlayerMessage],
        type_queue: asyncio.Queue[PlayerMessageType],
    ):
        """
        Top-level message producer that reads messages from the websocket and enqueues them into the appropriate queues.

        Args:
            websocket: The FastAPI WebSocket instance
            game_id: The UUID of the game associated with the websocket connection
            player_id: The UUID of the player associated with the websocket connection
            general_queue: The queue for general player messages
            type_queue: The queue for phase-specific player messages

        Notes:
            This producer reads messages from the websocket and enqueues them into the appropriate queues based on their type.
            Upon socket closure, it ensures that the queues are drained and shut down properly to allow consumers to finish. Upon exception in the producer itself, the same cleanup is performed.
        """
        async with self.router_lifecycle(
            game_id, player_id, "Websocket", {general_queue, type_queue}
        ):

            async for message in websocket.iter_bytes():

                # For some reason betterproto works like that Message().parse(bytes) but pydantic checks before we parse then, thus we circumvent validation like this:
                with patch.object(betterproto.Message, "_validate_field_groups", side_effect=lambda _: None):  # type: ignore
                    message_obj = PlayerMessage()
                    message_obj.parse(message)

                logger.info(
                    f"Received PlayerMessage from player {player_id} in game {game_id}: {message_obj}"
                )

                _, payload = betterproto.which_one_of(message_obj, "payload")

                match payload:
                    case GeneralPlayerMessage():
                        await general_queue.put(payload)
                        logger.info(
                            f"Enqueued GeneralPlayerMessage from player {player_id} in game {game_id} to general queue: {payload}"
                        )

                    case _:
                        await type_queue.put(payload)  # type: ignore
                        logger.info(
                            f"Enqueued PlayerMessage from player {player_id} in game {game_id} to phase-specific queue: {payload}"
                        )

 
    @staticmethod
    async def message_generator[T](queue: asyncio.Queue[T]) -> AsyncGenerator[T, None]:
        """
        Generator to simplify consuming messages. Exits on shutdown (see how shutdown is triggered in the producer_lifecycle).
        """
        while True:
            try:
                message = await queue.get()
                yield message
                queue.task_done()

            except asyncio.QueueShutDown:
                return

    async def handle_general_messages(
        self,
        game_id: UUID,
        player_id: UUID,
        websocket: WebSocket,
        general_queue: asyncio.Queue[GeneralPlayerMessage],
    ):

        async for message in self.message_generator(general_queue):
            logger.info(
                f"Handling GeneralPlayerMessage in game {game_id} from player {player_id}: {message}"
            )

            _, payload = betterproto.which_one_of(message, "payload")

            match payload:
                case PlayerHeartbeatResponse() as message:
                    self.create_background_task(
                        self.handle_player_heartbeat_response(
                            game_id, player_id, message
                        ),
                        name=f"HeartbeatResponseHandler-{game_id}-{player_id}",
                    )
                case _:
                    logger.error(
                        f"Unknown message payload received in GeneralPlayerMessage {game_id}: {message}"
                    )
                    raise WebSocketException(
                        code=status.WS_1002_PROTOCOL_ERROR,
                        reason="Unknown message payload in GeneralPlayerMessage.",
                    )

    async def handle_player_heartbeat_response(
        self, game_id: UUID, player_id: UUID, message: PlayerHeartbeatResponse
    ):

        player_conn = self.get_player_connection(game_id, player_id)
        player_conn.heart_beat_event.set()  # trigger event to stop timer

    async def heartbeat_clock(self, interval: float = 30.0):
        """
        Periodically send heartbeat requests to the player to ensure the connection is alive. And no silent disconnections happened.
        """

        while True:
            await asyncio.sleep(interval)

            i = 0
            for game_id, game_conns in self.active_connections.items():
                for player_id, player_conn in game_conns.players.items():

                    if i == 10000:
                        logger.info(
                            f"Heartbeat clock processed 10000 players, giving control back to event loop..."
                        )
                        await asyncio.sleep(0)  # wont ever need but...
                        i = 0

                    i += 1

                    if (
                        player_conn.websocket.client_state
                        == websockets.WebSocketState.CONNECTED
                    ):

                        self.create_background_task(
                            self.dispatch_heartbeat_request(
                                game_id, player_id, player_conn=player_conn
                            ),
                            name=f"HeartbeatRequestDispatcher-{game_id}-{player_id}",
                        )

    async def dispatch_heartbeat_request(
        self,
        game_id: UUID,
        player_id: UUID,
        player_conn: PlayerConnectionType,
        timeout: float = 5.0,
    ):
        """
        Dispatch a heartbeat request to a player and wait for the response within a timeout period. If no response is received, close the websocket(suspect to have found a silent disconnection).
        """

        logger.info(
            f"Dispatching heartbeat request to player {player_id} in game {game_id}."
        )

        player_conn.heart_beat_event.clear()

        try:
            await self.send_personal_message(
                game_id,
                player_id,
                GeneralServerMessage(heartbeat_request=ServerHeartbeatRequest()),
            )
        
        # catch when the socket was closed while sending the heartbeat request
        except WebSocketException:
            logger.debug(f"Tried to send heartbeat request to closed socket for player {player_id} in game {game_id}, skipping wait for response.")
        
        else:
            try:
                await asyncio.wait_for(player_conn.heart_beat_event.wait(), timeout=10.0)
                logger.info(
                    f"Heartbeat response received in time from player {player_id} in game {game_id}."
                )
            except asyncio.TimeoutError:
                logger.warning(
                    f"No heartbeat response received from player {player_id} in game {game_id} within timeout period. Closing websocket..."
                )

                asyncio.create_task(
                    self.disconnect(
                        game_id=game_id,
                        player_id=player_id,
                        code=status.WS_1006_ABNORMAL_CLOSURE,
                        reason="No heartbeat response received within timeout period.",
                    )
                )

    @abstractmethod
    async def handle_type_messages(
        self,
        game_id: UUID,
        player_id: UUID,
        message_queue: asyncio.Queue[PlayerMessageType],
    ): ...


if __name__ == "__main__":
    pass
