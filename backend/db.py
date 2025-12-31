# dont use form __future__ import annotations cause it breaks sqlmodel relationships

import uuid
from sqlalchemy import Engine, CheckConstraint, UniqueConstraint, Column, ARRAY, Integer
from sqlmodel import SQLModel, Field, Relationship, create_engine


DB_URL = "postgresql+psycopg2://postgres:12345678@localhost/battleships"

class GamePlayerLink(SQLModel, table=True):
    game_id: uuid.UUID = Field(foreign_key="game.id", primary_key=True)
    player_id: uuid.UUID = Field(foreign_key="player.id", primary_key=True)
    player_slot: int = Field(default=1, primary_key=True) 

    __table_args__ = (
        CheckConstraint('player_slot IN (1, 2)', name='check_player_slot'),
        UniqueConstraint('game_id', 'player_slot', name='unique_game_player_slot'),
    )

class Player(SQLModel, table=True):
    id: uuid.UUID | None = Field(default_factory=uuid.uuid4, primary_key=True, index=True)
    games: list["Game"] = Relationship(back_populates="players", link_model=GamePlayerLink)
    

class Game(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True, index=True)
    players: list["Player"] = Relationship(back_populates="games", link_model=GamePlayerLink)
    battle_grid_rows: int = Field()
    battle_grid_cols: int = Field()
    ship_lengths: list[int] = Field(sa_column=Column("ship_lengths", ARRAY(Integer)))  # e.g., [5, 4, 3, 3, 2]
  




def get_db_engine(DB_URL: str = DB_URL) -> Engine:
    
    return create_engine(DB_URL) 