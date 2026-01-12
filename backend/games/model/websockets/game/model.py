from typing import Collection

from ....relations import Orientation, Ship as DBShip
from ...model import BaseModel, Ship, Base


class ActiveShip(Ship):
    hits: int = 0


class ShipGrid(BaseModel):
    __pydantic_custom_init__ = True

    cells: list[list[tuple[ActiveShip | None, bool]]]  # [Ship on cell, was shot?]
    ships: list[ActiveShip] = []
    sunk_ships: list[ActiveShip] = []
    
    def __init__(self, ships: Collection[Ship | DBShip], rows: int, cols: int):
        cells = [[None for _ in range(cols)] for _ in range(rows)]
        super().__init__(cells=cells)

        for _ship in ships:
            
            ship = ActiveShip.model_validate(_ship)
            self.ships.append(ship)
            
            if ship.orientation == Orientation.HORIZONTAL:
                for c in range(ship.head_col, ship.head_col + ship.length):
                    self.cells[ship.head_row][c] = (ship, False)
            else:
                for r in range(ship.head_row, ship.head_row + ship.length):
                    self.cells[r][ship.head_col] = (ship, False)


    def shoot_at(self, row: int, col: int) -> tuple[bool, Ship | None]:
        ship = self.cells[row][col][0]
        if ship:
            ship.hits += 1
            if ship.hits == ship.length:
                self.sunk_ships.append(ship)
            return True, ship if ship.hits == ship.length else None
        else:
            return False, None
    

    class View(Base):
        cells: list[list[bool]]  # was shot?
        ships: list[ActiveShip]

    def get_own_view(self) -> View:
        return self.View(
            cells=[[cell[1] for cell in row] for row in self.cells],
            ships=self.ships,
        )

    def get_opponent_view(self) -> View:
        return self.View(
            cells=[[cell[1] for cell in row] for row in self.cells],
            ships=self.sunk_ships,
        )
    





