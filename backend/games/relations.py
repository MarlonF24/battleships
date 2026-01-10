import uuid, enum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import CheckConstraint, UniqueConstraint, ARRAY, Integer, ForeignKey, ForeignKeyConstraint, Enum


from ..db import Base
from ..players import Player

class GamePhase(enum.Enum):
    PREGAME = "pregame"
    GAME = "game"
    COMPLETED = "completed"

class Game(Base):
    __tablename__ = "game"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=lambda: uuid.uuid4(), index=True)
    players: Mapped[list["Player"]] = relationship(secondary="game_player_link", back_populates="games")
    battle_grid_rows: Mapped[int] = mapped_column()
    battle_grid_cols: Mapped[int] = mapped_column()
    ship_lengths: Mapped[list[int]] = mapped_column(ARRAY(Integer))  # e.g., [5, 4, 3, 3, 2]
    phase: Mapped[GamePhase] = mapped_column(Enum(GamePhase), default=GamePhase.PREGAME)
  
  
class GamePlayerLink(Base):
    __tablename__ = "game_player_link"

    game_id: Mapped[str] = mapped_column(ForeignKey("game.id"), primary_key=True)
    player_id: Mapped[str] = mapped_column(ForeignKey("player.id"), primary_key=True)
    player_slot: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)

    ships: Mapped[list["Ship"]] = relationship(back_populates="game_player_link", cascade="all, delete-orphan")

    __table_args__ = (
    CheckConstraint('player_slot IN (1, 2)', name='check_player_slot'),
    UniqueConstraint('game_id', 'player_slot', name='unique_game_player_slot'),
    UniqueConstraint('game_id', 'player_id', name='different_players_per_game')
    )

class Orientation(enum.Enum):
    HORIZONTAL = "horizontal"
    VERTICAL = "vertical"


class Ship(Base):
    __tablename__ = "ship"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    game_id: Mapped[uuid.UUID] = mapped_column()
    player_id: Mapped[uuid.UUID] = mapped_column()

    length: Mapped[int] = mapped_column()
    head_row: Mapped[int] = mapped_column()
    head_col: Mapped[int] = mapped_column()
    orientation: Mapped[Orientation] = mapped_column(Enum(Orientation))

    __table_args__ = (
        ForeignKeyConstraint(
            ["game_id", "player_id"],
            ["game_player_link.game_id", "game_player_link.player_id"],
        ),
    )

    game_player_link: Mapped["GamePlayerLink"] = relationship(back_populates="ships")