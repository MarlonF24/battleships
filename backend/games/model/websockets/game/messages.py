from ..pregame import PregameWSServerMessage
from ..messages import *
from .model import ShipGrid, Ship


class GameWSPlayerMessage(WSPlayerMessage):
    ...

class GameWSPlayerShotMessage(GameWSPlayerMessage):
    row: int
    col: int





class GameWSServerMessage(WSServerMessage):
    ...

class GameWSServerShotResultMessage(GameWSServerMessage):
    row: int
    col: int
    hit: bool
    sunk_ship: Ship | None

class GameWSServerStateMessage(GameWSServerMessage):
    own_ship_grid: ShipGrid.View
    opponent_ship_grid: ShipGrid.View


class WSServerOpponentConnectionMessage(GameWSServerMessage, PregameWSServerMessage):
    opponent_connected: bool