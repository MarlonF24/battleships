import betterproto, asyncio
from collections.abc import AsyncGenerator, Coroutine
from contextlib import asynccontextmanager
from uuid import UUID
from dataclasses import dataclass, field
from typing import Generic, Literal, TypeVar, Any, Callable, overload
from abc import ABC, abstractmethod
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import WebSocket, WebSocketException, websockets, status
from unittest.mock import patch

from backend.logger import logger
from ..model import GamePlayerMessage, GeneralPlayerMessage, PregameServerMessage, GameServerMessage, ServerOpponentConnectionMessage, PlayerMessage, ServerMessage, GeneralServerMessage, PregamePlayerMessage
from ..relations import Game, Player


@dataclass
class PlayerConnection():
    websocket: WebSocket

PlayerConnectionType = TypeVar('PlayerConnectionType', bound=PlayerConnection)

@dataclass
class GameConnections(ABC, Generic[PlayerConnectionType]):
    players: dict[UUID, PlayerConnectionType] = field(default_factory=dict) # type: ignore
    
    def add_player(self, player_id: UUID, connection: PlayerConnectionType):
        if player_id not in self.players and len(self.players) >= 2:
            raise WebSocketException(code=status.WS_1008_POLICY_VIOLATION, reason="Attempted to add third player to game connections.")
        
        if player_id not in self.players:
            logger.info(f"Added player {player_id} to PregameGameConnections.")
            self.players[player_id] = connection
        else:
            logger.info(f"Player {player_id} reconnected. Updating connection.")
            self.players[player_id].websocket = connection.websocket
            
    
    def num_players(self) -> int:
        return len(self.players)
    
    def validate_player_in_game(self, player_id: UUID):
        if player_id not in self.players:
            
            raise WebSocketException(code=status.WS_1008_POLICY_VIOLATION, reason=f"Requested game connections data with foreign player ID. {player_id} not found in {list(self.players.keys())}.")

    def __iter__(self):
        return iter(self.players.items())

    @overload
    def get_opponent_id(self, own_id: UUID, raise_on_missing: str) -> UUID: ...
    @overload
    def get_opponent_id(self, own_id: UUID, raise_on_missing: None) -> UUID | None: ...
    def get_opponent_id(self, own_id: UUID, raise_on_missing: str | None = None) -> UUID | None:
        self.validate_player_in_game(own_id)
        
        for player_id in self.players.keys():
            if player_id != own_id:
                return player_id
        
        if raise_on_missing is not None:
            raise ValueError("Opponent ID not found.")
        
        return None
    
    def num_of_currently_connected(self) -> int:
        return sum(1 for conn in self.players.values() if conn.websocket.client_state == websockets.WebSocketState.CONNECTED)
    
    def currently_connected(self, player_id: UUID) -> bool:
        """Check if player is currently connected."""
        try:
            self.validate_player_in_game(player_id)
        except WebSocketException:
            raise WebSocketException(code=status.WS_1008_POLICY_VIOLATION, reason="Trying to check connection status of a player not in the game.")
        
        return self.players[player_id].websocket.client_state == websockets.WebSocketState.CONNECTED
            
    
    def initially_connected(self, player_id: UUID) -> bool:
        """Check if player was connected at some time."""
        return player_id in self.players
    

    def get_connection_message(self, player_id: UUID) -> GeneralServerMessage:
        self.validate_player_in_game(player_id)
        
        return GeneralServerMessage(opponent_connection_message=ServerOpponentConnectionMessage(
            opponent_connected=self.currently_connected(player_id),
            initially_connected=self.initially_connected(player_id)
        ))
    
    @overload
    def get_opponent_connection(self, own_id: UUID, raise_on_missing: str) -> PlayerConnectionType: ...
    @overload
    def get_opponent_connection(self, own_id: UUID, raise_on_missing: None) -> PlayerConnectionType | None: ...
    def get_opponent_connection(self, own_id: UUID, raise_on_missing: str | None = None) -> PlayerConnectionType | None:
        opponent_id = self.get_opponent_id(own_id, raise_on_missing=raise_on_missing)
        
        if opponent_id:
            return self.players[opponent_id]
        
        return None
    
    def remove_player(self, player_id: UUID):
        self.validate_player_in_game(player_id)
        
        del self.players[player_id]
        logger.info(f"Removed player {player_id} from GameConnections.")
    

GameConnectionsType = TypeVar('GameConnectionsType', bound=GameConnections[Any])

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

    def create_background_task(self, coro: Coroutine[Any, Any, Any]) :
        """
        Let a coroutine be executed in the global event loop as a background task, by being stored in the connection manager's background tasks set garbage collection is prevented.
        """
        task = asyncio.create_task(coro)
        self.background_tasks.add(task)

        def task_done_callback(t: asyncio.Task[Any]):
            self.background_tasks.discard(t)

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
    async def add_player_connection(self, game: Game, player: Player, websocket: WebSocket, session: AsyncSession):
        """Add a player's connection to the active connections for a game."""
        ...

    @abstractmethod 
    async def allow_connection(self, game: Game, player: Player, websocket: WebSocket, session: AsyncSession) -> WebSocketException | GameConnectionsType :
        """
        Check whether the player is allowed to connect to the game. If yes, return a GameConnectionsType, otherwise a WebSocketException.
        """
        ...
    
    async def connect(self, game: Game, player: Player, websocket: WebSocket, session: AsyncSession):
        """Handle the connection process for a player in a game. First checks if connection is allowed based on a method, then accepts the websocket and adds the player connection to the active connections."""
        
        res = await self.allow_connection(game, player, websocket, session)
        
        if isinstance(res, WebSocketException):
            logger.info(f"Connection not allowed for game {game.id}, player {player.id}: {res.reason}")
            raise res
        
        if game.id not in self.active_connections:
            self.active_connections[game.id] = res
            logger.info(f"Created new GameConnections for game {game.id}")


        await websocket.accept() 


        logger.info(f"WebSocket connection accepted for game {game.id}, player {player.id}")
        await self.add_player_connection(game, player, websocket, session)
       


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
    


    async def close_and_remove_game_connections(self, game: Game):
        """Close all player connections in a game and remove the game from active connections."""
        game_conns = self.get_game_connections(game)

        await asyncio.gather(*(self.disconnect(game, Player(id=player_id)) for player_id in game_conns.players))

        del self.active_connections[game.id]



    async def send_server_message(self, websocket: WebSocket, message: ServerMessageType | GeneralServerMessage, raise_on_closed_socket: str | None = None):
        """
        Send a server message over the websocket. Wraps the message into the appropriate envelope.
        Args:
            raise_on_closed_socket: If set, raises a WebSocketException with this reason when the socket is closed.
        """
        if websocket.client_state == websockets.WebSocketState.CONNECTED:
            message = ServerMessage(**{self.server_message_payload_map[type(message)]: message}) # type: ignore

            await websocket.send_bytes(bytes(message))
        
        elif raise_on_closed_socket:
            raise WebSocketException(code=status.WS_1008_POLICY_VIOLATION, reason="Attempted to send message on closed WebSocket.")
        

    async def broadcast(self, game: Game, sender: Player | None, message: ServerMessageType | GeneralServerMessage | MessageFactory, only_opponent: bool = False, raise_on_closed_socket: str | None = None):
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
    
            
            if connection.websocket.client_state != websockets.WebSocketState.CONNECTED:
                if raise_on_closed_socket is not None:
                    raise WebSocketException(code=status.WS_1008_POLICY_VIOLATION, reason=raise_on_closed_socket)
            else:
                coroutines.append(self.send_server_message(connection.websocket, message_instance))

        await asyncio.gather(*coroutines)



    async def send_personal_message(self, game: Game, player: Player, message: ServerMessageType | GeneralServerMessage, raise_on_closed_socket: str | None = None):    
        """
        Send a personal message to a specific player in a game. Mainly meant for the player who ultimately initialised this call.
        
        Args:
            raise_on_closed_socket: If set, raises a WebSocketException with this reason when the socket is closed.
        """    
        
        player_connection = self.get_player_connection(game, player)
        
        await self.send_server_message(player_connection.websocket, message, raise_on_closed_socket=raise_on_closed_socket)


    async def inform_opponent_about_own_connection(self, game: Game, sender: Player):
        """Notify the opponent about the sender's connection status. If connected is True"""
        if game_conns := self.get_game_connections(game, raise_on_missing=False):
            
            message = game_conns.get_connection_message(sender.id)
            
            await self.broadcast(game, sender, message, only_opponent=True) 
            
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

    async def start_up(self, game: Game, player: Player, websocket: WebSocket, session: AsyncSession):
        """
        Start up the websocket connection lifecycle for a player in a game.

        Args:
            game: The game instance associated with the websocket connection
            player: The player instance associated with the websocket connection
            websocket: The FastAPI WebSocket instance
            session: The SQLAlchemy AsyncSession for database operations
        """
        await self.connect(game, player, websocket, session)
        await asyncio.gather(
            self.inform_opponent_about_own_connection(game, player),
            self.inform_self_about_opponent_connection(game, player)
            )
  

    async def clean_up(self, game: Game, player: Player, session: AsyncSession, wse: WebSocketException | None = None):
        """
        Clean up after websocket connection ends, inform opponent and disconnect websocket.

        Args:
            game: The game instance associated with the websocket connection
            player: The player instance associated with the websocket connection
            session: The SQLAlchemy AsyncSession for database operations
            wse: The WebSocketException instance to send in the closure if one occurred. Defaults to None.
        """
        if game.id in self.active_connections:
            await self.inform_opponent_about_own_connection(game, player)
            if wse:
                code = wse.code
                reason = wse.reason
            else:
                code = status.WS_1000_NORMAL_CLOSURE
                reason = "Normal Closure"
                
            await self.disconnect(game, player, code=code, reason=reason)

        logger.warning(f"Trying to clean up connection for game {game.id}, player {player.id} but no active connection found. Either it has already been removed or was never established. Please check whether this is intended.")



    @asynccontextmanager
    async def websocket_lifecycle(self, game: Game, player: Player, websocket: WebSocket, session: AsyncSession):
        """
        Context manager handling the full lifecycle of a websocket connection for a player in a game.

        Args:
            game: The game instance associated with the websocket connection
            player: The player instance associated with the websocket connection
            websocket: The FastAPI WebSocket instance
            session: The SQLAlchemy AsyncSession for database operations

        Yields:
            The two message queues, general messages and phase-specific messages.
        """
        
        wse: WebSocketException | None = None

        try:
            logger.info(f"Starting WebSocket lifecycle for game {game.id}, player {player.id}")
            await self.start_up(game, player, websocket, session)

            general_message_queue = asyncio.Queue[GeneralPlayerMessage](maxsize=10)
            message_type_queue = asyncio.Queue[PlayerMessageType](maxsize=10)

            
            yield general_message_queue, message_type_queue

       
        except WebSocketException as e:
            wse = e
            logger.info(f"WebSocketException caught in lifecycle for game {game.id}, player {player.id}: {e}")

        except Exception as e:
            wse = WebSocketException(code=status.WS_1011_INTERNAL_ERROR, reason="WebSocket closed due to internal error.")
            logger.error(f"Exception caught in lifecycle for game {game.id}, player {player.id}: {e}")

        finally:
            logger.info(f"Cleaning up WebSocket lifecycle for game {game.id}, player {player.id}")
            await self.clean_up(game, player, session, wse)



    async def handle_websocket(self, game: Game, player: Player, websocket: WebSocket, session: AsyncSession):
        """
        Entry point for the FastAPI websocket endpoint

        Args:
            game: The game instance associated with the websocket connection
            player: The player instance associated with the websocket connection
            websocket: The FastAPI WebSocket instance
            session: The SQLAlchemy AsyncSession for database operations

        Notes:
            If the connection is closed normally by the client or even the backend itself (Status 1000), the generator in the producer will exhaust, the producer will let the queues drain out and then shut them down, causing the consumers to finish as well.
            If an exception propagates in a consumer, the whole TaskGroup will be cancelled, including the producer. Then the lifecycle's cleanup will be executed with will close possibly open connections.

        """
        
        async with self.websocket_lifecycle(game, player, websocket, session) as (general_message_queue, message_type_queue):
            async with asyncio.TaskGroup() as tg:
                

                tg.create_task(self.message_producer(websocket, game, player, general_message_queue, message_type_queue))

                # tg.create_task(self.general_type_message_consumer(game, player, websocket, session, general_message_queue))

                tg.create_task(self.type_message_consumer(game, player, session, message_type_queue))


    T = TypeVar('T')

    @staticmethod
    async def message_generator(queue: asyncio.Queue[T]) -> AsyncGenerator[T, None]:
        while True:
            try:
                message = await queue.get()
                yield message
                queue.task_done()

            except asyncio.QueueShutDown:
                raise StopAsyncIteration


    async def general_type_message_consumer(self, game: Game, player: Player, websocket: WebSocket, session: AsyncSession, general_queue: asyncio.Queue[GeneralPlayerMessage]):
        pass
    

    async def message_producer(self, websocket: WebSocket, game: Game, player: Player, general_queue: asyncio.Queue[GeneralPlayerMessage], type_queue: asyncio.Queue[PlayerMessageType]):
        """
        _summary_

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
        try:
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
        
        except Exception as e:
            logger.info(f"Exiting message producer for game {game.id}, player {player.id} due to exception: {e}")
        
        finally:    
            # socket closed -> generator exhausted -> wait for consumers to finish
            await asyncio.gather(
                self.drain_and_shutdown_queue(general_queue),
                self.drain_and_shutdown_queue(type_queue)
            )
            

    async def drain_and_shutdown_queue(self, queue: asyncio.Queue[Any]):
        # wait till consumers have processed all messages
        await queue.join()
        # then shut down the queue to stop the generator for the consumers for them to finish
        queue.shutdown()
   
    @abstractmethod
    async def type_message_consumer(self, game: Game, player: Player, session: AsyncSession, message_queue: asyncio.Queue[PlayerMessageType]):
        ...

if __name__ == "__main__":
    pass


