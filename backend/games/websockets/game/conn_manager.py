import asyncio, betterproto
from uuid import UUID
from fastapi import WebSocket
from sqlalchemy.ext.asyncio import AsyncSession

from backend.games.relations import Player

from ..conn_manager import *

from ....db import session_mkr
from ...model import (
    GameServerMessage,
    GamePlayerMessage,
    GameServerShotMessage,
    GameServerShotResultMessage,
    GameServerTurnMessage,
    GameServerGameOverMessage,
    GamePlayerShotMessage,
    ShipGrid,
    ActiveShipLogic,
    GameOverResult,
)

from ...relations import Game, GameMode, GamePhase, GamePlayerLink
from .connection import GameGameConnections, GamePlayerConnection


class GameConnectionManager(
    ConnectionManager[
        GameGameConnections, GamePlayerConnection, GameServerMessage, GamePlayerMessage
    ]
):

    async def allow_connection(
        self, game: Game, player: Player, websocket: WebSocket
    ) -> WebSocketException | GameGameConnections:
        if game.phase != GamePhase.GAME:
            return WebSocketException(
                code=status.WS_1008_POLICY_VIOLATION,
                reason=f"Cannot connect to WebSocket for game {game.id} which is not in GAME phase but {game.phase}.",
            )
        return GameGameConnections()

    async def add_player_connection(
        self, game: Game, player: Player, websocket: WebSocket
    ):
        async with session_mkr.begin() as session:

            link = await session.get_one(GamePlayerLink, (game.id, player.id))
            ships = link.ships

            game_obj = await link.awaitable_attrs.game

            player_connection = GamePlayerConnection(
                websocket=websocket,
                ship_grid=ShipGrid(
                    ships=ships,
                    rows=game_obj.battle_grid_rows,
                    cols=game_obj.battle_grid_cols,
                ),
                heart_beat_event=asyncio.Event(),
            )

        game_connections = self.get_game_connections(game.id)
        game_connections.mode = game.mode
        await game_connections.add_player(player.id, player_connection)



    async def start_up(self, game: Game, player: Player, websocket: WebSocket):
        await super().start_up(game, player, websocket)

        game_connections = self.get_game_connections(game.id)

        if not game_connections.started:
            if opponent := game_connections.get_opponent_id(
                player.id, raise_on_missing=None
            ):
                opponent_currently_connected = game_connections.currently_connected(
                    opponent
                )

                if opponent_currently_connected:
                    logger.info(f"Both players connected in game {game.id}.")
                    game_connections.start_battle()

                    # broadcast game state to both players
                    await self.broadcast(
                        game.id,
                        None,
                        lambda player_id: GameServerMessage(
                            game_state=game_connections.get_game_state(player_id)
                        ),
                    )

                    # notify first turn player
                    await game_connections.shot_lock.acquire()
                    await self.send_turn_messages(game_id=game.id)
        else:
            await self.send_personal_message(
                game.id,
                player.id,
                GameServerMessage(
                    game_state=game_connections.get_game_state(player.id)
                ),
            )

            player_conn = game_connections.players[player.id]

            # if the player double connected during their turn we just notify them that they have the turn (note: that means the lock is not aquired rn)
            if game_connections.turn_player_id != player.id or player_conn.duplicate_connection_cleanup:
                await self._dispatch_turn_message(
                    game.id, player.id, release_lock=False
                )

            else:
                game_connections.reconnect_event.set()  # signal that player has reconnected during their turn
            

    async def clean_up(
        self, game_id: UUID, player_id: UUID, wse: WebSocketException | None = None
    ) -> None:
        if game_connections := self.get_game_connections(game_id, raise_on_missing=False):

            player_conn = game_connections.players.get(player_id, None)

            if player_conn and not player_conn.duplicate_connection_cleanup:
                # Is it this player's turn?
                if (
                    game_connections.running
                    and game_connections.turn_player_id == player_id
                ):
                    # Did he NOT submit his shot already before this cleanup and its currently being processed in the background?
                    if not game_connections.shot_lock.locked():
                        await game_connections.shot_lock.acquire()

                        # not passing the cleanup task here as task to crash along so its unaffected
                        self.create_background_task(
                            self.handle_reconnection_timeout(game_id, player_id),
                            name=f"handle_reconnection_timeout_{game_id}_{player_id}",
                        )

                        logger.info(
                            f"Player {player_id} disconnected during their turn in game {game_id}, taking random shot for them."
                        )
                        # wait in the background for a reconnection

            await super().clean_up(game_id, player_id, wse=wse)
            

    async def handle_type_messages(
        self,
        game_id: UUID,
        player_id: UUID,
        message_queue: asyncio.Queue[GamePlayerMessage],
    ):
        shot_message_queue: asyncio.Queue[GamePlayerShotMessage] = asyncio.Queue()

        async with asyncio.TaskGroup() as tg:
            tg.create_task(
                self.type_player_message_router(
                    game_id, player_id, message_queue, shot_message_queue
                ),
                name=f"game_player_message_router_{game_id}_{player_id}",
            )
            tg.create_task(
                self.shot_message_consumer(game_id, player_id, shot_message_queue),
                name=f"game_shot_consumer_{game_id}_{player_id}",
            )

    async def type_player_message_router(
        self,
        game_id: UUID,
        player_id: UUID,
        input_queue: asyncio.Queue[GamePlayerMessage],
        shot_message_queue: asyncio.Queue[GamePlayerShotMessage],
    ):
        async with self.router_lifecycle(
            game_id, player_id, input_queue, output_queues={shot_message_queue}
        ):

            game_connections = self.get_game_connections(game_id)

            async for message in self.message_generator(input_queue):

                if not game_connections.started:
                    logger.warning(
                        f"Received message in game {game_id} before both players connected (skipping): {message}"
                    )
                    continue

                if game_connections.ended:
                    logger.warning(
                        f"Received message in game {game_id} after game has ended (skipping): {message}"
                    )
                    continue

                _, payload = betterproto.which_one_of(message, "payload")

                match payload:
                    case GamePlayerShotMessage():
                        await shot_message_queue.put(payload)

                    case _:
                        logger.error(
                            f"Unhandled message type received in game {game_id}: {payload}"
                        )
                        raise WebSocketException(
                            code=status.WS_1002_PROTOCOL_ERROR,
                            reason="Unknown message payload in GamePlayerMessage.",
                        )

    async def shot_message_consumer(
        self,
        game_id: UUID,
        player_id: UUID,
        message_queue: asyncio.Queue[GamePlayerShotMessage],
    ):
        game_connections = self.get_game_connections(game_id)

        async for message in self.message_generator(message_queue):
            if game_connections.shot_lock.locked():
                raise WebSocketException(
                    code=status.WS_1008_POLICY_VIOLATION,
                    reason=f"Player {player_id} tried to submit shot in game {game_id} while previous shot is still being processed. He couldnt have gotten his turn message yet.",
                )

            # lock to prevent multiple shots being processed simultaneously, the lock will only be released after the next ever turn message is sent (see below)
            await game_connections.shot_lock.acquire()

            self_task = asyncio.current_task()

            self.create_background_task(
                self.handle_shot_message(game_id, player_id, message),
                name=f"handle_shot_message_{game_id}_{player_id}",
                task_to_crash_along=self_task,
            )

    async def handle_shot_message(
        self, game_id: UUID, player_id: UUID, shot_msg: GamePlayerShotMessage
    ):
        """Handle a shot message from a player:
        - update game state
        - if appropriate, swap turn
        - notify both player about shot result
        - check for game over condition
        - send turn messages
        """

        game_connections = self.get_game_connections(game_id)

        logger.info(
            f"Handling shot message for player {player_id} in game {game_id} at ({shot_msg.row}, {shot_msg.column})"
        )
        
        
        if game_connections.turn_player_id != player_id:
            logger.error(
                f"Player {player_id} tried to shoot out of turn in game {game_id}. Closing their connection."
            )

            game_connections.shot_lock.release()  # release the lock as the shot will not be processed

            raise WebSocketException(
                code=status.WS_1008_POLICY_VIOLATION,
                reason=f"Player {player_id} tried to shoot out of turn.",
                )

        try:
            opponent_connection = game_connections.get_opponent_connection(
                player_id,
                raise_on_missing="Trying to shot at grid even though opponent has NEVER INITIALLY connected.",
            )

            opponent_ship_grid = opponent_connection.ship_grid
            hit, sunk_ship = opponent_ship_grid.shoot_at(shot_msg.row, shot_msg.column)

            logger.debug(
                f"Player {player_id} {'hit' if hit else 'missed'} in game {game_id}. {f'Sunk a ship: {sunk_ship}' if sunk_ship else 'No ship sunk.'}"
            )

            

            match game_connections.mode:
                case GameMode.SINGLESHOT:
                    swap_turn = True

                case GameMode.STREAK:
                    swap_turn = not hit

                case GameMode.SALVO:
                    game_connections.salvo_shots_remaining -= 1

                    swap_turn = game_connections.salvo_shots_remaining == 0

                    logger.debug(
                        f"Player {player_id} has {game_connections.salvo_shots_remaining} salvo shots remaining in game {game_id}."
                    )

                    # reset salvo shots if turn is swapped
                    if swap_turn:
                        game_connections.reset_salvo_shots()
                        logger.debug(
                            f"Resetting salvo shots in game {game_id} to {game_connections.salvo_shots_remaining}."
                        )

            if swap_turn:
                game_connections.swap_turn()
                logger.info(
                    f"Swapped turn to player {game_connections.turn_player_id} in game {game_id}."
                )

            if sunk_ship:
                sunk_ship = ActiveShipLogic.to_protobuf(sunk_ship)

            server_shot_msg = GameServerShotMessage(
                row=shot_msg.row, column=shot_msg.column
            )

            await asyncio.gather(
                # Notify shooting player about shot result, this will only send if they are still connected
                self.send_personal_message(
                    game_id,
                    player_id,
                    GameServerMessage(
                        shot_result=GameServerShotResultMessage(
                            shot=server_shot_msg, is_hit=hit, sunk_ship=sunk_ship
                        )
                    ),
                    raise_on_closed_socket=None,
                ),
                # Notify opponent about incoming shot
                self.broadcast(
                    game_id,
                    player_id,
                    GameServerMessage(shot=server_shot_msg),
                    only_opponent=True,
                    raise_on_closed_socket=None,
                ),
                return_exceptions=False,  # No need for true as we both personal and broadcast dont raise on closed socket here
            )

            if opponent_ship_grid.all_ships_sunk:
                logger.info(f"Player {player_id} has won game {game_id}!")
                await self.end_battle(game_id)
                return

            await self.send_turn_messages(game_id)

        except Exception as e:
            logger.exception(
                f"Error while handling shot message for player {player_id} in game {game_id}: {e}"
            )

            # if anything goes wrong during shot processing, close the whole game, players can restart the battle from the beginning if they reload the page, as a new game connections object and new ship grids will be created
            await self.close_player_connections(
                game_id,
                reason=WebSocketException(
                    code=status.WS_1011_INTERNAL_ERROR,
                    reason="SERVER ERROR: Error occurred during shot processing. The game must be restarted via a refresh.",
                ),
                remove_game_connection=True,
            )

    async def send_turn_messages(self, game_id: UUID):
        """Sends turn messages to both players, handling reconnections if necessary."""

        game_connections = self.get_game_connections(game_id)

        # end game if no players are connected
        if game_connections.num_of_currently_connected() == 0:
            logger.info(f"No players connected in game {game_id}, ending battle...")
            await self.end_battle(game_id)
            return

        if not (turn_player_id := game_connections.turn_player_id):
            raise WebSocketException(
                code=status.WS_1011_INTERNAL_ERROR,
                reason="Turn player ID not set when trying to send turn messages.",
            )

        non_turn_player_id = game_connections.get_opponent_id(
            turn_player_id,
            raise_on_missing="Trying to get non-turn player ID even though opponent has NEVER INITIALLY connected.",
        )

        # notify non-turn player first
        await self._dispatch_turn_message(
            game_id, non_turn_player_id, release_lock=False
        )

        # if current turn player is not connected, give them some time to reconnect
        if not game_connections.currently_connected(turn_player_id):

            await self.handle_reconnection_timeout(game_id, turn_player_id)

        # otherwise just send the turn message normally
        else:
            await self._dispatch_turn_message(
                game_id, turn_player_id, release_lock=True
            )

    async def handle_reconnection_timeout(
        self, game_id: UUID, turn_player_id: UUID, timeout: float = 8.0
    ):
        """
        Handles waiting for a player to reconnect within a timeout period during their turn.
        If they reconnect, sends the turn message; if not, takes a random shot for them.
        """

        game_conns = self.get_game_connections(game_id)

        logger.info(
            f"Waiting for player {turn_player_id} to reconnect in game {game_id} for up to {timeout} seconds."
        )
        game_conns.reconnect_event.clear()  # set to unsignaled state

        try:
            await asyncio.wait_for(game_conns.reconnect_event.wait(), timeout=timeout)

            logger.info(
                f"Player {turn_player_id} reconnected in game {game_id} whilst waiting to notify them about their turn."
            )

            await self._dispatch_turn_message(
                game_id, turn_player_id, release_lock=True
            )

        except asyncio.TimeoutError:
            logger.info(
                f"Player {turn_player_id} did not reconnect in time in game {game_id}, choosing random move."
            )

            await self.take_random_shot_for_player(game_id, turn_player_id)

    async def _dispatch_turn_message(
        self, game_id: UUID, player_id: UUID, release_lock: bool
    ):
        """
        Actually sends the turn message to the player. Conditionally releases the shot lock.
        NOTE: Expecting that if the shot lock is to be released, it is currently held and the player is connected.
        """

        game_connections = self.get_game_connections(game_id)

        try:
            error_msg = None

            if release_lock:
                error_msg = "Tried to send turn message and release shot lock, but socket closed. Can only release the lock if the socket to that player was still open and the message was sent."

            await self.send_personal_message(
                game_id,
                player_id,
                GameServerMessage(
                    turn=GameServerTurnMessage(
                        opponents_turn=player_id != game_connections.turn_player_id
                    )
                ),
                raise_on_closed_socket=error_msg,
            )

        finally:
            if release_lock:
                # release the lock no matter what, if the sending failed, the error will propagate and the cleanup will handle, grabbing the lock again
                game_connections = self.get_game_connections(game_id)

                # raises if the lock was never acquired
                game_connections.shot_lock.release()

    async def take_random_shot_for_player(self, game_id: UUID, player_id: UUID):
        """
        Take a random shot for a player who failed to reconnect in time during their turn. Recursively calls shot message handler.
        """
        game_connections = self.get_game_connections(game_id)

        opponents_connection = game_connections.get_opponent_connection(
            player_id,
            raise_on_missing="Trying to choose random move for opponent that has NEVER INITIALLY connected.",
        )

        random_shot = opponents_connection.ship_grid.random_shot()

        await self.handle_shot_message(
            game_id, player_id, GamePlayerShotMessage(*random_shot)
        )

    async def end_battle(self, game_id: UUID):
        """Ends the battle in a game, broadcasting game over messages, closing connections, and saving results to the database."""
        
        logger.info(
            f"Ending battle in game {game_id}. Broadcasting game over messages, closing connections and saving results to DB..."
        )

        game_connections = self.get_game_connections(game_id)
        game_connections.end_battle()

        lambda_result: Callable[[UUID], GameOverResult] = lambda pid: (
            GameOverResult.PREMATURE
            if not any(
                player.ship_grid.all_ships_sunk
                for player in game_connections.players.values()
            )
            else (
                GameOverResult.LOSS
                if game_connections.players[pid].ship_grid.all_ships_sunk
                else GameOverResult.WIN
            )
        )

        result_per_player = {
            pid: lambda_result(pid) for pid in game_connections.players.keys()
        }

        async with session_mkr.begin() as session:
            # get the game object into the new session
            game = await session.get_one(Game, game_id)
            game.phase = GamePhase.COMPLETED

            await asyncio.gather(
                *(
                    self.save_game_result(game, pid, result_per_player[pid], session)
                    for pid in game_connections.players.keys()
                )
            )
            logger.info(f"Saved game results for game {game.id} to database.")

        await self.broadcast(
            game_id,
            None,
            lambda pid: GameServerMessage(
                game_over=GameServerGameOverMessage(result=result_per_player[pid])
            ),
            raise_on_closed_socket=None,
        )

        await self.close_player_connections(
            game_id, reason=WebSocketException(
                code=status.WS_1000_NORMAL_CLOSURE,
                reason="Game completed.",
            ), remove_game_connection=True
        )

    async def save_game_result(
        self, game: Game, player_id: UUID, result: GameOverResult, session: AsyncSession
    ):
        link = await session.get_one(GamePlayerLink, (game.id, player_id))
        link.outcome = result


conn_manager = GameConnectionManager()
