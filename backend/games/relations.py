import uuid, enum, datetime
from typing import Any, List, Optional
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import (
    CheckConstraint,
    DateTime,
    Dialect,
    Index,
    UniqueConstraint,
    Integer,
    ForeignKey,
    Enum,
    JSON,
    text,
    func,
    TypeDecorator
)
from sqlalchemy.dialects.postgresql import JSONB


from ..db import Base
from ..players import Player
from .websocket_models import GameOverResult, Ship


class GamePhase(enum.Enum):
    PREGAME = "PREGAME"
    GAME = "GAME"
    COMPLETED = "COMPLETED"


class GameMode(enum.Enum):
    SINGLESHOT = "SINGLESHOT"  # 1 shot per turn
    SALVO = "SALVO"  # 3 shots per turn
    STREAK = "STREAK"  # until miss


class Game(Base):
    __tablename__ = "game"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True, default=uuid.uuid4, index=True
    )
    
    player_links: Mapped[list["GamePlayerLink"]] = relationship(
        back_populates="game", cascade="all, delete-orphan"
    )

    players: Mapped[list["Player"]] = relationship(secondary="game_player_link", back_populates="games", viewonly=True)

    battle_grid_rows: Mapped[int] = mapped_column()
    battle_grid_cols: Mapped[int] = mapped_column()
    ship_lengths: Mapped[dict[int, int]] = mapped_column(JSON)
    phase: Mapped[GamePhase] = mapped_column(Enum(GamePhase), default=GamePhase.PREGAME)
    mode: Mapped[GameMode] = mapped_column(Enum(GameMode), default=GameMode.SINGLESHOT)
    
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now()
    )

    __table_args__ = (
        # partial index to help passive cleanup of inactive games
        Index(
            "idx_inactive_games",
            "created_at", "phase", # sort by created_at, and phase which is what the cleaner needs 
            postgresql_where=text("phase != 'COMPLETED'"),
        ),
    )



class ShipListType(TypeDecorator[List[Ship]]):
    # Bridge between Protobuf Ship objects and Postgres JSONB
    
    impl = JSONB
    cache_ok = True

    # Python -> Database
    def process_bind_param(self, value: Optional[List[Ship]], dialect: Dialect) -> Optional[List[dict[str, Any]]]:
        if value is None:
            return None
    
        return [s.to_dict() for s in value]

    
    # Database -> Python
    def process_result_value(self, value: Optional[List[dict[str, Any]]], dialect: Dialect) -> List[Ship]:
        if value is None:
            return []
        
        return [Ship.from_dict(s) for s in value]



class GamePlayerLink(Base):
    __tablename__ = "game_player_link"

    game_id: Mapped[str] = mapped_column(
        ForeignKey("game.id", ondelete="CASCADE"), primary_key=True
    )
    player_id: Mapped[str] = mapped_column(
        ForeignKey("player.id", ondelete="CASCADE"), primary_key=True
    )
    player_slot: Mapped[int] = mapped_column(Integer, default=1)

    ships: Mapped[List[Ship]] = mapped_column(ShipListType, default=list)
    

    outcome: Mapped[GameOverResult | None] = mapped_column(
        Enum(GameOverResult), nullable=True
    )

    game: Mapped["Game"] = relationship("Game", back_populates="player_links")
    player: Mapped["Player"] = relationship("Player", back_populates="game_links")

    __table_args__ = (
        CheckConstraint("player_slot IN (1, 2)", name="check_player_slot"),
        UniqueConstraint("game_id", "player_slot", name="unique_game_player_slot"),
    )


