# dont use form __future__ import annotations cause it breaks sqlmodel relationships

import uuid, os, dotenv

from sqlalchemy.orm import DeclarativeBase, mapped_column, Mapped, relationship
from sqlalchemy import CheckConstraint, UniqueConstraint, ARRAY, Integer, ForeignKey, JSON
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession, AsyncAttrs



dotenv.load_dotenv()


PG_DB_URL = os.getenv("PG_DB_URL")

if not PG_DB_URL:
    raise ValueError("PG_DB_URL environment variable is not set in .env file")
    
db_engine = create_async_engine(PG_DB_URL)

session_mkr: async_sessionmaker[AsyncSession] = async_sessionmaker(bind=db_engine, class_=AsyncSession, expire_on_commit=False)


async def get_db_session():
    async with session_mkr() as session:
        yield session



class Base(AsyncAttrs, DeclarativeBase):
    pass



class Player(Base):
    __tablename__ = "player"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=lambda: uuid.uuid4(), index=True)
    games: Mapped[list["Game"]] = relationship(secondary="game_player_link", back_populates="players")
    

class Game(Base):
    __tablename__ = "game"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=lambda: uuid.uuid4(), index=True)
    players: Mapped[list["Player"]] = relationship(secondary="game_player_link", back_populates="games")
    battle_grid_rows: Mapped[int] = mapped_column()
    battle_grid_cols: Mapped[int] = mapped_column()
    ship_lengths: Mapped[list[int]] = mapped_column(ARRAY(Integer))  # e.g., [5, 4, 3, 3, 2]
  
  
class GamePlayerLink(Base):
    __tablename__ = "game_player_link"

    game_id: Mapped[str] = mapped_column(ForeignKey("game.id"), primary_key=True)
    player_id: Mapped[str] = mapped_column(ForeignKey("player.id"), primary_key=True)
    player_slot: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)

    ship_positions: Mapped[dict[int, list[int]]] = mapped_column(JSON, default=dict)  # ship length -> [row, col] positions

    __table_args__ = (
    CheckConstraint('player_slot IN (1, 2)', name='check_player_slot'),
    UniqueConstraint('game_id', 'player_slot', name='unique_game_player_slot'),
    UniqueConstraint('game_id', 'player_id', name='different_players_per_game')
    )


