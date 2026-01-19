import asyncio, betterproto
from uuid import UUID
from fastapi import WebSocket
from dataclasses import dataclass, field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.games.relations import Player

from .conn_manager import *

from ...db import session_mkr
from ..model import ActiveShipLogic, GameServerShotMessage, GameServerStateMessage, GameServerMessage, GamePlayerShotMessage, GamePlayerMessage, ShipGrid, GameServerShotResultMessage, GameServerTurnMessage
from ..relations import Game, GamePhase, Ship


@dataclass
class GamePlayerConnection(PlayerConnection):
    ship_grid: ShipGrid

@dataclass
class GameGameConnections(GameConnections[GamePlayerConnection]):
    first_to_shoot: UUID | None = None
    turn_player_id: UUID | None = None
    _started: bool = field(default=False, init=False)
    _ended: bool = field(default=False, init=False)
    shot_lock: asyncio.Lock = field(default_factory=asyncio.Lock, init=False)
    reconnect_event: asyncio.Event = field(default_factory=asyncio.Event, init=False)

    def add_player(self, player_id: UUID, connection: GamePlayerConnection):
        super().add_player(player_id, connection)
        
        if not self.first_to_shoot:
            self.first_to_shoot = player_id

    @property
    def started(self) -> bool:
        return self._started
    

    def start_battle(self):
        self.turn_player_id = self.first_to_shoot
        self._started = True

    @property
    def ended(self) -> bool:
        return self._ended
    
    def end_battle(self):
        self._ended = True

    
    def get_game_state(self, player_id: UUID) -> GameServerStateMessage:  
        player_connection = self.players[player_id]
        opponent_connection = self.get_opponent_connection(player_id, raise_on_missing="Trying to get game state even though opponent has NEVER INITIALLY connected.")

        return GameServerStateMessage(
            own_grid=player_connection.ship_grid.get_own_view(),
            opponent_grid=opponent_connection.ship_grid.get_opponent_view(),
        )
    
    def swap_turn(self):
        if not self.turn_player_id:
            self.turn_player_id = self.first_to_shoot
        else:
            next_turn_player_id = self.get_opponent_id(self.turn_player_id, raise_on_missing="Cannot swap turn, next turn player not in game.")            
            self.turn_player_id = next_turn_player_id
    


class GameConnectionManager(ConnectionManager[GameGameConnections, GamePlayerConnection, GameServerMessage, GamePlayerMessage]):
    
    def __init__(self):
        super().__init__()


    async def allow_connection(self, game: Game, player: Player, websocket: WebSocket, session: AsyncSession) -> WebSocketException | GameGameConnections:
        if game.phase != GamePhase.GAME:
            return WebSocketException(code=status.WS_1008_POLICY_VIOLATION, reason=f"Cannot connect to WebSocket for game {game.id} which is not in GAME phase but {game.phase}.")
        return GameGameConnections()
    

    async def add_player_connection(self, game: Game, player: Player, websocket: WebSocket, session: AsyncSession):
        ships = await session.scalars(
            select(Ship)
            .where(Ship.game_id == game.id) # type: ignore
            .where(Ship.player_id == player.id) # type: ignore
        )

        ships = set(ships.all())


        game_obj = await session.get_one(Game, game.id)

        player_connection = GamePlayerConnection(websocket=websocket, ship_grid=ShipGrid(ships=ships, rows=game_obj.battle_grid_rows, cols=game_obj.battle_grid_cols))
        
        self.active_connections[game.id].add_player(player.id, player_connection)
        


    async def start_up(self, game: Game, player: Player, websocket: WebSocket, session: AsyncSession) :
        await super().start_up(game, player, websocket, session)
        
        game_connections = self.get_game_connections(game)
    

        if not game_connections.started:   
            if opponent := game_connections.get_opponent_id(player.id, raise_on_missing=None):
                opponent_currently_connected = game_connections.currently_connected(opponent)

                if opponent_currently_connected:
                    logger.info(f"Both players connected in game {game.id}.")
                    game_connections.start_battle()

                    # broadcast game state to both players
                    await self.broadcast(game, None, lambda player_id: GameServerMessage(game_state=game_connections.get_game_state(player_id)))
                    
                    # notify first turn player
                    await self.send_turn_message(game)
        else:
            await self.send_personal_message(game, player, GameServerMessage(game_state=game_connections.get_game_state(player.id)))

            if game_connections.turn_player_id == player.id:
                game_connections.reconnect_event.set()  # signal that player has reconnected during their turn


    
    async def type_message_consumer(self, game: Game, player: Player, session: AsyncSession, message_queue: asyncio.Queue[GamePlayerMessage]):

        game_connections = self.get_game_connections(game)

        async for message in self.message_generator(message_queue):
            
            if not game_connections.started:
                logger.warning(f"Received message in game {game.id} before both players connected.")
                continue

            if game_connections.ended:
                logger.warning(f"Received message in game {game.id} after game has ended.")
                continue


            _, payload = betterproto.which_one_of(message, "payload")

            match payload:
                case GamePlayerShotMessage() as shot_msg:
                    if game_connections.shot_lock.locked():
                        raise WebSocketException(code=status.WS_1008_POLICY_VIOLATION, reason=f"Player {player.id} tried to submit shot in game {game.id} while previous shot is still being processed. He couldnt have gotten his turn message yet.")
                    
                    # lock to prevent multiple shots being processed simultaneously
                    async with game_connections.shot_lock:
                        await self.handle_shot_message(game, player, shot_msg)

                case _:
                    logger.error(f"Unhandled message type received in game {game.id}: {payload}")
                    raise WebSocketException(code=status.WS_1002_PROTOCOL_ERROR, reason="Unknown message payload in GamePlayerMessage.")

    
    async def clean_up(self, game: Game, player: Player, session: AsyncSession, wse: WebSocketException | None = None) -> None:
        if game_connections := self.get_game_connections(game, raise_on_missing=False):
            if game_connections.started and game_connections.turn_player_id == player.id:
                logger.info(f"Player {player.id} disconnected during their turn in game {game.id}, taking random shot for them.")
                await self.take_random_shot_for_player(game, player)
            await super().clean_up(game, player, session, wse=wse)


    async def end_battle(self, game: Game):
        game_connections = self.get_game_connections(game)
        game_connections.end_battle()
        async with session_mkr.begin() as session:
            # get the game object into the new session
            game = await session.merge(game)
            game.phase = GamePhase.COMPLETED


    async def handle_shot_message(self, game: Game, player: Player, shot_msg: GamePlayerShotMessage):
        logger.info(f"Handling shot message for player {player.id} in game {game.id} at ({shot_msg.row}, {shot_msg.column})")

        game_connections = self.get_game_connections(game)
        
        
        if game_connections.turn_player_id != player.id:
            raise WebSocketException(code=status.WS_1008_POLICY_VIOLATION, reason=f"Player {player.id} tried to shoot out of turn.")


        opponent_connection = game_connections.get_opponent_connection(player.id, raise_on_missing="Trying to shot at grid even though opponent has NEVER INITIALLY connected.")
        
        opponent_ship_grid = opponent_connection.ship_grid
        hit, sunk_ship = opponent_ship_grid.shoot_at(shot_msg.row, shot_msg.column)

        if sunk_ship:
            sunk_ship = ActiveShipLogic.to_protobuf(sunk_ship)

        server_shot_msg = GameServerShotMessage(row=shot_msg.row, column=shot_msg.column)


        await asyncio.gather(
            # Notify shooting player about shot result, this will only send if they are still connected
            self.send_personal_message(
                game, 
                player, 
                GameServerMessage(
                               shot_result=GameServerShotResultMessage(
                                   shot=server_shot_msg, 
                                   is_hit=hit, 
                                   sunk_ship=sunk_ship
                                   )
                                )
            ),

            # Notify opponent about incoming shot
            self.broadcast(
                game, 
                player, 
                GameServerMessage(shot=server_shot_msg),
                only_opponent=True
            )
        )


        if opponent_ship_grid.all_ships_sunk:
            logger.info(f"Player {player.id} has won game {game.id}!")
            await self.end_battle(game)
            return

        game_connections.swap_turn()
        

        await self.send_turn_message(game)


    async def send_turn_message(self, game: Game):
        game_connections = self.get_game_connections(game)
        turn_player_id = game_connections.turn_player_id
        
        
        if not turn_player_id:
            raise WebSocketException(code=status.WS_1008_POLICY_VIOLATION, reason="Trying to send turn message even though turn player is not set.")
        
        # end game if no players are connected
        if game_connections.num_of_currently_connected() == 0:
            logger.info(f"No players connected in game {game.id}, ending battle.")
            await self.end_battle(game)
            return
        
        
        # if current turn player is not connected, give them some time to reconnect
        if not game_connections.currently_connected(turn_player_id): 
            
            game_connections.reconnect_event.clear() # set to unsignaled state
            
            self.create_background_task(self.handle_reconnection_timeout(game, Player(id=turn_player_id))) 
        
        else: 
            await self.send_personal_message(game, Player(id=turn_player_id), GameServerMessage(turn=GameServerTurnMessage()))


    async def handle_reconnection_timeout(self, game: Game, turn_player: Player):
        game_conns = self.get_game_connections(game)

        
        try:
            await asyncio.wait_for(game_conns.reconnect_event.wait(), timeout=10.0)
            
            logger.info(f"Opponent {turn_player.id} reconnected in game {game.id} whilst waiting to notify them about their turn.")
            
            await self.send_personal_message(game, turn_player, GameServerMessage(turn=GameServerTurnMessage()))
    

        except asyncio.TimeoutError:
            logger.info(f"Opponent {turn_player.id} did not reconnect in time in game {game.id}, choosing random move.")
            # NOTE: If both players disconnect during the same turn, this will lead to an infinite loop of random shots
            await self.take_random_shot_for_player(game, turn_player)
            
            


    async def take_random_shot_for_player(self, game: Game, player: Player):
        game_connections = self.get_game_connections(game)
        
        opponents_connection = game_connections.get_opponent_connection(player.id, raise_on_missing="Trying to choose random move for opponent that has NEVER INITIALLY connected.")   
        
        random_shot = opponents_connection.ship_grid.random_shot()

        await self.handle_shot_message(game, player, GamePlayerShotMessage(*random_shot))



conn_manager = GameConnectionManager()






