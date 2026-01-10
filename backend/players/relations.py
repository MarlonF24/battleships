import uuid
from typing import TYPE_CHECKING
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..db import Base

if TYPE_CHECKING:
    from ..games.relations import Game

class Player(Base):
    __tablename__ = "player"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=lambda: uuid.uuid4(), index=True)

    games: Mapped[list["Game"]] = relationship(secondary="game_player_link", back_populates="players")
    
