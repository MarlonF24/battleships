import random
from pydantic import BaseModel
from typing import Any, Collection


from ..relations import Ship as DBShip
from .websocket_models import Ship, ActiveShip, Orientation, ShipGridView, ShipGridViewRow

def to_camel(string: str) -> str:
    parts = string.split('_')
    return parts[0] + ''.join(word.capitalize() for word in parts[1:])


class Base(BaseModel):
    class Config:
        from_attributes = True
        alias_generator = to_camel
        populate_by_name = True



class PregameParams(Base):
    battle_grid_rows: int
    battle_grid_cols: int
    ship_lengths: dict[int, int]  # length -> count

  

class GameParams(PregameParams):
    own_ships: list[Ship]


class ActiveShipLogic(Base):
    length: int
    orientation: Orientation
    head_row: int
    head_col: int
    hits: list[bool] 

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


    @classmethod
    def from_protobuf(cls, ship: ActiveShip | Ship | DBShip) -> "ActiveShipLogic":
        match ship:
            case DBShip() :
                hits = [False for _ in range(ship.length)]
            case Ship() :
                hits = [False for _ in range(ship.length)]
            case ActiveShip() :
                hits = ship.hits
        
        
        return cls(
            length=ship.length,
            orientation=Orientation(ship.orientation),
            head_row=ship.head_row,
            head_col=ship.head_col,
            hits=hits,
        )
    
    @classmethod
    def to_protobuf(cls, ship: "ActiveShipLogic") -> ActiveShip:
        return ActiveShip(
            length=ship.length,
            orientation=ship.orientation,
            head_row=ship.head_row,
            head_col=ship.head_col,
            hits=ship.hits,
        )
    

class CellInfo(BaseModel):
    ship: ActiveShipLogic | None = None
    was_shot: bool = False


class ShipGrid(BaseModel):
    __pydantic_custom_init__ = True

    cells: list[list[CellInfo]]  # [Ship on cell, was shot?]

    @property
    def ships(self) -> list[ActiveShipLogic]:
        return [cellInfo.ship for row in self.cells for cellInfo in row if cellInfo.ship is not None]
    
    @property
    def sunk_ships(self) -> list[ActiveShipLogic]:
        return [ship for ship in self.ships if ship.is_sunk()]
    

    def __init__(self, ships: Collection[Ship] | Collection[DBShip], rows: int, cols: int):
        cells = [[None for _ in range(cols)] for _ in range(rows)]
        super().__init__(cells=cells)

        for _ship in ships:
            
            ship = ActiveShipLogic.from_protobuf(_ship)
            self.ships.append(ship)
            
            if ship.orientation == Orientation.HORIZONTAL:
                for c in range(ship.head_col, ship.head_col + ship.length):
                    self.cells[ship.head_row][c] = CellInfo(ship=ship, was_shot=False)
            else:
                for r in range(ship.head_row, ship.head_row + ship.length):
                    self.cells[r][ship.head_col] = CellInfo(ship=ship, was_shot=False)

    def shoot_at(self, row: int, col: int) -> tuple[bool, ActiveShipLogic | None]:
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
    

    def get_own_view(self) -> ShipGridView:
        return ShipGridView(
            hit_grid=[ShipGridViewRow(cells=[cell.was_shot for cell in row]) for row in self.cells],
            ships=[ActiveShipLogic.to_protobuf(ship) for ship in self.ships],
        )

    def get_opponent_view(self) -> ShipGridView:
        return ShipGridView(
            hit_grid=[ShipGridViewRow(cells=[cell.was_shot for cell in row]) for row in self.cells],
            ships=[ActiveShipLogic.to_protobuf(ship) for ship in self.sunk_ships],
        )
    
    def random_shot(self) -> tuple[int, int]:

        rows = len(self.cells)
        cols = len(self.cells[0]) if rows > 0 else 0

        unshot_positions = [(r, c) for r in range(rows) for c in range(cols) if not self.cells[r][c].was_shot]

        if not unshot_positions:
            raise ValueError("No unshot positions available.")

        return random.choice(unshot_positions)





