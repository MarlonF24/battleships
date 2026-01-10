from pydantic import BaseModel

from ..relations import Orientation



class Ship(BaseModel):
    length: int
    orientation: Orientation
    head_row: int
    head_col: int



class PregameParams(BaseModel):
    battle_grid_rows: int
    battle_grid_cols: int
    ship_lengths: list[int]

    class Config:
        from_attributes = True

class GameParams(PregameParams):
    own_ships: list[Ship]
