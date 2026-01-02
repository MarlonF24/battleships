from pydantic import BaseModel


class GameParams(BaseModel):
    battle_grid_rows: int
    battle_grid_cols: int
    ship_lengths: list[int]

    class Config:
        from_attributes = True

