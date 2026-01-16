import asyncio
from uuid import UUID
import betterproto
from fastapi import WebSocket
from dataclasses import dataclass, field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.games.relations import Player

from .conn_manager import *

from ..model import ActiveShipLogic, GameServerStateMessage, GameServerMessage, GamePlayerShotMessage, GamePlayerMessage, ShipGrid, GameServerShotResultMessage, GameServerTurnMessage
from ..relations import Game, GamePhase, Ship


@dataclass
class GamePlayerConnection(PlayerConnection):
    ship_grid: ShipGrid

@dataclass
class GameGameConnections(GameConnections[GamePlayerConnection]):
    players: dict[UUID, GamePlayerConnection] = field(default_factory=dict) # type: ignore
    first_to_shoot: UUID | None = None
    turn_player_id: UUID | None = None
    _started: bool = field(default=False, init=False)
    _ended: bool = field(default=False, init=False)

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
        opponent_connection = next(
            conn for pid, conn in self.players.items() if pid != player_id
        )

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
    
    async def connect(self, game: Game, player: Player, websocket: WebSocket, session: AsyncSession):
        await super().connect(game, player, websocket, session)

        if game.id not in self.active_connections:
            self.active_connections[game.id] = GameGameConnections()
            logger.info(f"Created new GameConnections for game {game.id}")


        ships = await session.scalars(
            select(Ship)
            .where(Ship.game_id == game.id) # type: ignore
            .where(Ship.player_id == player.id) # type: ignore
        )

        ships = set(ships.all())


        game_obj = await session.get_one(Game, game.id)

        player_connection = GamePlayerConnection(websocket=websocket, ship_grid=ShipGrid(ships=ships, rows=game_obj.battle_grid_rows, cols=game_obj.battle_grid_cols))
        
        self.active_connections[game.id].add_player(player.id, player_connection)
        


    async def clean_up(self, game: Game, player: Player, websocket: WebSocket, session: AsyncSession):
        game_connections = self.get_game_connections(game)
        if game_connections.started and game_connections.turn_player_id == player.id:
            logger.info(f"Player {player.id} disconnected during their turn in game {game.id}, taking random shot for them.")
            await self.take_random_shot_for_player(game, player, session)

        await super().clean_up(game, player, websocket, session)

        raise NotImplementedError("Implement how active connections are eventually removed from self.active_connections in subclasses.")


    async def end_battle(self, game: Game, session: AsyncSession):
        game_connections = self.get_game_connections(game)
        game_connections.end_battle()
        game.phase = GamePhase.COMPLETED
        await session.commit()


    async def _handle_websocket(self, game: Game, player: Player, websocket: WebSocket, session: AsyncSession):
        game_connections = self.get_game_connections(game)
        
        await self.send_personal_message(game, player, GameServerMessage(game_state=game_connections.get_game_state(player.id)))



        if not game_connections.started:   
            if opponent := game_connections.get_opponent_id(player.id, raise_on_missing=None):
                opponent_currently_connected = game_connections.currently_connected(opponent)

                if opponent_currently_connected:
                    logger.info(f"Both players connected in game {game.id}.")
                    game_connections.start_battle()
                    await self.send_turn_message(game, session)


        async for message in self.message_generator(websocket, game, player):
            
            if not game_connections.started:
                logger.warning(f"Received message in game {game.id} before both players connected.")
                continue

            if game_connections.ended:
                logger.warning(f"Received message in game {game.id} after game has ended.")
                continue


            _, payload = betterproto.which_one_of(message, "payload")

            match payload:
                case GamePlayerShotMessage() as shot_msg:
                    await self.handle_shot_message(game, player, shot_msg, session)
                case _:
                    logger.warning(f"Unhandled message type received in game {game.id}: {payload}")
                    continue

    
    async def handle_shot_message(self, game: Game, player: Player, shot_msg: GamePlayerShotMessage, session: AsyncSession):
        game_connections = self.get_game_connections(game)
        
        if game_connections.turn_player_id != player.id:
            raise WebSocketException(code=1002, reason=f"Player {player.id} tried to shoot out of turn.")


        opponent_connection = game_connections.get_opponent_connection(player.id, raise_on_missing="Trying to shot at grid even though opponent has NEVER INITIALLY connected.")
        
        opponent_ship_grid = opponent_connection.ship_grid
        hit, sunk_ship = opponent_ship_grid.shoot_at(shot_msg.row, shot_msg.column)

        if sunk_ship:
            sunk_ship = ActiveShipLogic.to_protobuf(sunk_ship)


        await self.broadcast(game, player, GameServerMessage(shot_result=GameServerShotResultMessage(row=shot_msg.row, column=shot_msg.column, is_hit=hit, sunk_ship=sunk_ship)))

        if opponent_ship_grid.all_ships_sunk:
            logger.info(f"Player {player.id} has won game {game.id}!")
            await self.end_battle(game, session)
            return

        game_connections.swap_turn()

        await self.send_turn_message(game, session)


    async def send_turn_message(self, game: Game, session: AsyncSession):
        game_connections = self.get_game_connections(game)
        turn_player_id = game_connections.turn_player_id
        
        
        if not turn_player_id:
            raise WebSocketException(code=1002, reason="Trying to send turn message even though turn player is not set.")
        
        # if current turn player is not connected, give them some time to reconnect
        if not game_connections.currently_connected(turn_player_id): 
            reconnected = await self.wait_for_reconnection(game, turn_player_id, 10)
            
            if not reconnected:
                logger.info(f"Opponent {turn_player_id} did not reconnect in time in game {game.id}, choosing random move.")
                # NOTE: If both players disconnect during the same turn, this will lead to an infinite loop of random shots
                await self.take_random_shot_for_player(game, Player(id=turn_player_id), session)
                return 
            
            else:
                logger.info(f"Opponent {turn_player_id} reconnected in game {game.id} whilst waiting to notify them about their turn.")


        await self.send_personal_message(game, Player(id=turn_player_id), GameServerMessage(turn=GameServerTurnMessage()))



    async def wait_for_reconnection(self, game: Game, player_id: UUID, seconds: int) -> bool: 
        game_connections = self.get_game_connections(game)
        
        for _ in range(seconds): # wait up to time seconds
            if game_connections.currently_connected(player_id):
                return True
            
            await asyncio.sleep(1)
    
        return False


    async def take_random_shot_for_player(self, game: Game, player: Player, session: AsyncSession):
        game_connections = self.get_game_connections(game)
        
        opponents_connection = game_connections.get_opponent_connection(player.id, raise_on_missing="Trying to choose random move for opponent that has NEVER INITIALLY connected.")   
        
        random_shot = opponents_connection.ship_grid.random_shot()

        await self.handle_shot_message(game, player, GamePlayerShotMessage(*random_shot), session)



conn_manager = GameConnectionManager()






