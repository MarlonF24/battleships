from pydantic import BaseModel

from ..relations import Orientation

def to_camel(string: str) -> str:
    parts = string.split('_')
    return parts[0] + ''.join(word.capitalize() for word in parts[1:])


class Base(BaseModel):
    class Config:
        from_attributes = True
        alias_generator = to_camel
        populate_by_name = True


class Ship(Base):
    length: int
    orientation: Orientation
    head_row: int
    head_col: int



class PregameParams(Base):
    battle_grid_rows: int
    battle_grid_cols: int
    ship_lengths: list[int]

  

class GameParams(PregameParams):
    own_ships: list[Ship]
