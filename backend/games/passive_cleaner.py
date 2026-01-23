import asyncio, datetime

from fastapi import WebSocketException, status
from dataclasses import dataclass
from typing import Any, Coroutine
from sqlalchemy import delete, or_, and_

from backend.logger import logger

from ..db import session_mkr
from .websockets.conn_manager import ConnectionManager
from .relations import Game, GamePhase


@dataclass
class Cleaner:
    """Periodically cleans up stale games from the database and active connections."""

    connection_managers: set[ConnectionManager[Any, Any, Any, Any]]

    def add_connection_manager(
        self, conn_manager: ConnectionManager[Any, Any, Any, Any]
    ):
        self.connection_managers.add(conn_manager)


    async def run_passive_cleanup(
        self,
        cleaning_interval_mins: float = 5,
        pregameTTL_mins: float = 10,
        gameTTL_mins: float = 35,  
    ):
        """
        Periodically checks the db for games that are not completed and depending on their phase and creation time deletes them from the db and potential active connections in connection managers.
        """

        while True:
            try:
                async with session_mkr.begin() as session:
                    now = datetime.datetime.now(datetime.timezone.utc)

                    pregame_cutoff = now - datetime.timedelta(minutes=pregameTTL_mins)
                    game_cutoff = now - datetime.timedelta(minutes=gameTTL_mins)

                    # this query should hopefully use the index on phase and created_at from ..db
                    games_deleted = await session.execute(
                        delete(Game)
                        .where(
                            or_(
                                and_(
                                    Game.phase == GamePhase.PREGAME,
                                    Game.created_at < pregame_cutoff,
                                ),
                                and_(
                                    Game.phase == GamePhase.GAME,
                                    Game.created_at < game_cutoff,
                                ),
                            )
                        )
                        .returning(Game.id)
                    )

                    deleted_ids = games_deleted.scalars().all()

                    logger.info(
                        f"Passive cleanup removed {len(deleted_ids)} stale games from the database. Looking for open connection objects to delete and close sockets for..."
                    )

                    tasks: list[Coroutine[Any, Any, Any]] = []

                    for game_id in deleted_ids:
                        for conn_manager in self.connection_managers:
                            if len(tasks) and len(tasks) % 1000 == 0:
                                await asyncio.sleep(0)  # yield to event loop, if we ever go big with this game :) 

                            if game_id in conn_manager.active_connections:
                                tasks.append(
                                    conn_manager.close_player_connections(
                                        game_id,
                                        reason=WebSocketException(
                                            code=status.WS_1008_POLICY_VIOLATION,
                                            reason="Game removed due to timeout.",
                                        ),
                                        remove_game_connection=True,
                                    ),
                                )
                    

                    await asyncio.gather(*tasks) # close_player_connection could only crash if the id was not found, but we already checked for that, for any other error, we log it, that should never happen 


                    logger.info(
                        f"Passive cleanup deleted (and if needed closed sockets for) leftover connections for {len(tasks)} of {len(deleted_ids)} deleted games."
                    )

            except Exception as e:
                logger.critical(f"Error during passive cleanup, that should never happen (check the functions called are bulletproof): {e}")



            await asyncio.sleep(cleaning_interval_mins * 60)


cleaner = Cleaner(connection_managers=set())