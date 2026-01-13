from typing import Any, Collection
from pydantic import Field

from ....relations import Orientation, Ship as DBShip
from ...model import BaseModel, Ship, Base


class ActiveShip(Ship):
    hits: list[bool] = Field(default_factory=list, validate_default=True) 

    def model_post_init(self, context: Any) -> None:
        if not self.hits:
            self.hits = [False for _ in range(self.length)]

    def is_sunk(self) -> bool:
        return self.hits.count(True) >= self.length
    
    def hit(self, idx: int) -> None:
        if self.is_sunk():
            raise ValueError("Tried to hit a ship that is already sunk")
        
        if self.hits[idx]:
            raise ValueError(f"Tried to hit already hit position {idx} of ship")
        
        self.hits[idx] = True

class CellInfo(BaseModel):
    ship: ActiveShip | None = None
    was_shot: bool = False


class ShipGrid(BaseModel):
    __pydantic_custom_init__ = True

    cells: list[list[CellInfo]]  # [Ship on cell, was shot?]

    @property
    def ships(self) -> list[ActiveShip]:
        return [cellInfo.ship for row in self.cells for cellInfo in row if cellInfo.ship is not None]
    
    @property
    def sunk_ships(self) -> list[ActiveShip]:
        return [ship for ship in self.ships if ship.is_sunk()]
    

    def __init__(self, ships: Collection[Ship | DBShip], rows: int, cols: int):
        cells = [[None for _ in range(cols)] for _ in range(rows)]
        super().__init__(cells=cells)

        for _ship in ships:
            
            ship = ActiveShip.model_validate(_ship)
            self.ships.append(ship)
            
            if ship.orientation == Orientation.HORIZONTAL:
                for c in range(ship.head_col, ship.head_col + ship.length):
                    self.cells[ship.head_row][c] = CellInfo(ship=ship, was_shot=False)
            else:
                for r in range(ship.head_row, ship.head_row + ship.length):
                    self.cells[r][ship.head_col] = CellInfo(ship=ship, was_shot=False)


    def shoot_at(self, row: int, col: int) -> tuple[bool, Ship | None]:
        if self.cells[row][col].was_shot:
            raise ValueError(f"Position ({row}, {col}) has already been shot.")
        
        self.cells[row][col].was_shot = True
        
        ship = self.cells[row][col].ship
        
        if ship:
            ship_idx = (col - ship.head_col) if ship.orientation == Orientation.HORIZONTAL else (row - ship.head_row)
            ship.hit(ship_idx)

            if ship.is_sunk():
                self.sunk_ships.append(ship)
            return True, ship if ship.is_sunk() else None
        else:
            return False, None
    

    class View(Base):
        cells: list[list[bool]]  # was shot?
        ships: list[ActiveShip]

    def get_own_view(self) -> View:
        return self.View(
            cells=[[cell.was_shot for cell in row] for row in self.cells],
            ships=self.ships,
        )

    def get_opponent_view(self) -> View:
        return self.View(
            cells=[[cell.was_shot for cell in row] for row in self.cells],
            ships=self.sunk_ships,
        )
    





