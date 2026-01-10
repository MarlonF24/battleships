from ..messages import *
from ...model import Ship


class PregameWSPlayerMessage(WSPlayerMessage):
    ...

class PregameWSPlayerReadyMessage(PregameWSPlayerMessage):
    ships: list[Ship]



class PregameWSServerMessage(WSServerMessage):
    ...

class PregameWSServerStateMessage(PregameWSServerMessage):
    num_players_ready: int
    self_ready: bool

