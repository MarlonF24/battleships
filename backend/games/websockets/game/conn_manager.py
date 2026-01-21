import asyncio, betterproto
from uuid import UUID
from fastapi import WebSocket
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.games.relations import Player

from ..conn_manager import *

from ....db import session_mkr
from ...model import GameServerMessage, GamePlayerMessage, GameServerShotMessage, GameServerShotResultMessage, GameServerTurnMessage, GameServerGameOverMessage, GamePlayerShotMessage, ShipGrid, ActiveShipLogic, GameOverResult

from ...relations import Game, GameMode, GamePhase, Ship, GamePlayerLink
from .connection import GameGameConnections, GamePlayerConnection


class GameConnectionManager(ConnectionManager[GameGameConnections, GamePlayerConnection, GameServerMessage, GamePlayerMessage]):
    

    async def allow_connection(self, game: Game, player: Player, websocket: WebSocket) -> WebSocketException | GameGameConnections:
        if game.phase != GamePhase.GAME:
            return WebSocketException(code=status.WS_1008_POLICY_VIOLATION, reason=f"Cannot connect to WebSocket for game {game.id} which is not in GAME phase but {game.phase}.")
        return GameGameConnections()
    

    async def add_player_connection(self, game: Game, player: Player, websocket: WebSocket):
        async with session_mkr.begin() as session:
        
            ships = await session.scalars(
                select(Ship)
                .where(Ship.game_id == game.id) # type: ignore
                .where(Ship.player_id == player.id) # type: ignore
            )

            ships = set(ships.all())


            game_obj = await session.get_one(Game, game.id)

            player_connection = GamePlayerConnection(websocket=websocket, ship_grid=ShipGrid(ships=ships, rows=game_obj.battle_grid_rows, cols=game_obj.battle_grid_cols))
            
        self.active_connections[game.id].add_player(player.id, player_connection)
        


    async def start_up(self, game: Game, player: Player, websocket: WebSocket) :
        await super().start_up(game, player, websocket)
        
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
                    await game_connections.shot_lock.acquire()  
                    await self.send_turn_messages(game)
        else:
            await self.send_personal_message(game, player, GameServerMessage(game_state=game_connections.get_game_state(player.id)))

            if game_connections.turn_player_id == player.id:
                game_connections.reconnect_event.set()  # signal that player has reconnected during their turn
            else:
                # notify player that it's opponent's turn
                await self._dispatch_turn_message(game, player, release_lock=False)


    async def clean_up(self, game: Game, player: Player, wse: WebSocketException | None = None) -> None:
       
        if game_connections := self.get_game_connections(game, raise_on_missing=False):
            # Is it this player's turn?
            if game_connections.running and game_connections.turn_player_id == player.id:
                # Did he NOT submit his shot already before this cleanup and its currently being processed in the background?
                if not game_connections.shot_lock.locked():
                    await game_connections.shot_lock.acquire()  
                        
                    # not passing the cleanup task here as task to crash along so its unaffected
                    self.create_background_task(
                        self.handle_reconnection_timeout(game, player),
                        name=f"handle_reconnection_timeout_{game.id}_{player.id}"
                    )

                    logger.info(f"Player {player.id} disconnected during their turn in game {game.id}, taking random shot for them.")
                    # wait in the background for a reconnection


            await super().clean_up(game, player, wse=wse)



    async def handle_type_messages(self, game: Game, player: Player, message_queue: asyncio.Queue[GamePlayerMessage]):
        shot_message_queue: asyncio.Queue[GamePlayerShotMessage] = asyncio.Queue()

        async with asyncio.TaskGroup() as tg:
            tg.create_task(
                self.type_player_message_router(
                    game, player, message_queue, shot_message_queue
                    ), 
                    name="game_message_type_router"
                )
            tg.create_task(
                self.shot_message_consumer(
                    game, player, shot_message_queue
                    ), 
                    name="game_shot_consumer"
                )



    async def type_player_message_router(self, game: Game, player: Player, input_queue: asyncio.Queue[GamePlayerMessage], shot_message_queue: asyncio.Queue[GamePlayerShotMessage]):
        async with self.router_lifecycle(game, player, input_queue, output_queues={shot_message_queue}):
            
            game_connections = self.get_game_connections(game)

            async for message in self.message_generator(input_queue):
                
                if not game_connections.started:
                    logger.warning(f"Received message in game {game.id} before both players connected (skipping): {message}")
                    continue

                if game_connections.ended:
                    logger.warning(f"Received message in game {game.id} after game has ended (skipping): {message}")
                    continue

                _, payload = betterproto.which_one_of(message, "payload")

                match payload:
                    case GamePlayerShotMessage():
                        await shot_message_queue.put(payload)

                    case _:
                        logger.error(f"Unhandled message type received in game {game.id}: {payload}")
                        raise WebSocketException(code=status.WS_1002_PROTOCOL_ERROR, reason="Unknown message payload in GamePlayerMessage.")


    async def shot_message_consumer(self, game: Game, player: Player, message_queue: asyncio.Queue[GamePlayerShotMessage]):
        game_connections = self.get_game_connections(game)

        async for message in self.message_generator(message_queue):
            if game_connections.shot_lock.locked():
                raise WebSocketException(code=status.WS_1008_POLICY_VIOLATION, reason=f"Player {player.id} tried to submit shot in game {game.id} while previous shot is still being processed. He couldnt have gotten his turn message yet.")
            
            # lock to prevent multiple shots being processed simultaneously, the lock will only be released after the next ever turn message is sent (see below)
            await game_connections.shot_lock.acquire()

            self_task = asyncio.current_task()
            
            self.create_background_task(
                self.handle_shot_message(game, player, message), 
                f"handle_shot_message_{game.id}_{player.id}",
                    task_to_crash_along=self_task
                    )



    async def handle_shot_message(self, game: Game, player: Player, shot_msg: GamePlayerShotMessage):
        game_connections = self.get_game_connections(game)
        

        logger.info(f"Handling shot message for player {player.id} in game {game.id} at ({shot_msg.row}, {shot_msg.column})")

        if game_connections.turn_player_id != player.id:
            if game_connections.currently_connected(player.id):
                game_connections.shot_lock.release()  # release the lock as the shot will not be processed
                
                raise WebSocketException(code=status.WS_1008_POLICY_VIOLATION, reason=f"Player {player.id} tried to shoot out of turn.")
        
        try:
            opponent_connection = game_connections.get_opponent_connection(player.id, raise_on_missing="Trying to shot at grid even though opponent has NEVER INITIALLY connected.")
            
            opponent_ship_grid = opponent_connection.ship_grid
            hit, sunk_ship = opponent_ship_grid.shoot_at(shot_msg.row, shot_msg.column)
            
            logger.debug(f"Player {player.id} {'hit' if hit else 'missed'} in game {game.id}. {f'Sunk a ship: {sunk_ship}' if sunk_ship else 'No ship sunk.'}")

            match game.mode:
                case GameMode.SINGLESHOT:
                    swap_turn = True
                
                case GameMode.STREAK:
                    swap_turn = not hit

                case GameMode.SALVO:
                    game_connections.salvo_shots_remaining -= 1
                    
                    swap_turn = game_connections.salvo_shots_remaining == 0

                    logger.debug(f"Player {player.id} has {game_connections.salvo_shots_remaining} salvo shots remaining in game {game.id}.")

                    # reset salvo shots if turn is swapped
                    if swap_turn:
                        game_connections.reset_salvo_shots()
                        logger.debug(f"Resetting salvo shots in game {game.id} to {game_connections.salvo_shots_remaining}.")


            if swap_turn:
                game_connections.swap_turn()
                logger.info(f"Swapped turn to player {game_connections.turn_player_id} in game {game.id}.")
                

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
                                    ),
                                    raise_on_closed_socket=None
                ),

                # Notify opponent about incoming shot
                self.broadcast(
                    game, 
                    player, 
                    GameServerMessage(shot=server_shot_msg),
                    only_opponent=True,
                    raise_on_closed_socket=None
                ),
                return_exceptions=False # No need for true as we both personal and broadcast dont raise on closed socket here
            )


            if opponent_ship_grid.all_ships_sunk:
                logger.info(f"Player {player.id} has won game {game.id}!")
                await self.end_battle(game)
                return

            await self.send_turn_messages(game)
        
        except Exception as e:
            logger.error(f"Error while handling shot message for player {player.id} in game {game.id}: {e}")
            
            # if anything goes wrong during shot processing, close the whole game, players can restart the battle from the beginning if they reload the page, as a new game connections object and new ship grids will be created
            await self.close_player_connections(game, reason="SERVER ERROR: Error occurred during shot processing. The game must be restarted via a refresh.", remove_game_connection=True)
            


    async def send_turn_messages(self, game: Game):
        game_connections = self.get_game_connections(game)

        # end game if no players are connected
        if game_connections.num_of_currently_connected() == 0:
            logger.info(f"No players connected in game {game.id}, ending battle.")
            await self.end_battle(game)
            return
        
        if not (turn_player_id := game_connections.turn_player_id):
            raise WebSocketException(code=status.WS_1011_INTERNAL_ERROR, reason="Turn player ID not set when trying to send turn messages.")
        
        
        non_turn_player_id = game_connections.get_opponent_id(turn_player_id, raise_on_missing="Trying to get non-turn player ID even though opponent has NEVER INITIALLY connected.")

        await self._dispatch_turn_message(game, Player(id=non_turn_player_id), release_lock=False)
        
        
        # if current turn player is not connected, give them some time to reconnect
        if not game_connections.currently_connected(turn_player_id): 
            
            await self.handle_reconnection_timeout(game, Player(id=turn_player_id)) 
        
        else: 
            await self._dispatch_turn_message(game, Player(id=turn_player_id), release_lock=True)



    async def handle_reconnection_timeout(self, game: Game, turn_player: Player, timeout: float = 8.0):
        game_conns = self.get_game_connections(game)

        logger.info(f"Waiting for player {turn_player.id} to reconnect in game {game.id} for up to {timeout} seconds.")
        game_conns.reconnect_event.clear() # set to unsignaled state
        
        
        try:
            await asyncio.wait_for(game_conns.reconnect_event.wait(), timeout=timeout)
            
            logger.info(f"Player {turn_player.id} reconnected in game {game.id} whilst waiting to notify them about their turn.")
            
            await self._dispatch_turn_message(game, turn_player, release_lock=True)
    

        except asyncio.TimeoutError:
            logger.info(f"Player {turn_player.id} did not reconnect in time in game {game.id}, choosing random move.")
            
            await self.take_random_shot_for_player(game, turn_player)
            
            

    async def _dispatch_turn_message(self, game: Game, player: Player, release_lock: bool):
        """Actually sends the turn message to the player. Only then release the shot lock."""
        game_connections = self.get_game_connections(game)
        
        try:
            error_msg = None
            if release_lock:
                error_msg = "Tried to send turn message and release shot lock, but socket closed. Can only release the lock if the socket to that player was still open and the message was sent."
            
            await self.send_personal_message(game, player, GameServerMessage(turn=GameServerTurnMessage(opponents_turn=player.id != game_connections.turn_player_id)), raise_on_closed_socket=error_msg)

        finally:
            if release_lock:
                # release the lock no matter what, if the sending failed, the error will propagate and the cleanup will handle, grabbing the lock again   
                game_connections = self.get_game_connections(game)
                
                # raises if the lock was never acquired
                game_connections.shot_lock.release()


    async def take_random_shot_for_player(self, game: Game, player: Player):
        game_connections = self.get_game_connections(game)
        
        opponents_connection = game_connections.get_opponent_connection(player.id, raise_on_missing="Trying to choose random move for opponent that has NEVER INITIALLY connected.")   
        
        random_shot = opponents_connection.ship_grid.random_shot()

        await self.handle_shot_message(game, player, GamePlayerShotMessage(*random_shot))



    async def end_battle(self, game: Game):
        logger.info(f"Ending battle in game {game.id}. Broadcasting game over messages and closing connections...")
        
        game_connections = self.get_game_connections(game)
        game_connections.end_battle()
        
        lambda_result: Callable[[UUID], GameOverResult] = lambda pid: (
            GameOverResult.PREMATURE if not any(player.ship_grid.all_ships_sunk for player in game_connections.players.values()) else
            GameOverResult.LOSS if game_connections.players[pid].ship_grid.all_ships_sunk else
            GameOverResult.WIN
        )

        result_per_player = {
            pid: lambda_result(pid) for pid in game_connections.players.keys()
        }


        async with session_mkr.begin() as session:
            # get the game object into the new session
            game = await session.merge(game)
            game.phase = GamePhase.COMPLETED

            await asyncio.gather(*(self.save_game_result(game, pid, result_per_player[pid], session) for pid in game_connections.players.keys()))
            logger.info(f"Saved game results for game {game.id} to database.")


        await self.broadcast(game, None, 
                             lambda pid: GameServerMessage(
                                 game_over=GameServerGameOverMessage(
                                     result = result_per_player[pid]
                                     )
                                ),
                                raise_on_closed_socket=None
                            )
        
        await self.close_player_connections(game, reason="Game completed.", remove_game_connection=True)


    async def save_game_result(self, game: Game, player_id: UUID, result: GameOverResult, session: AsyncSession):
        link = await session.get_one(GamePlayerLink, (game.id, player_id))
        link.outcome = result


conn_manager = GameConnectionManager()






