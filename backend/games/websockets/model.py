from pydantic import BaseModel


class PregameWSPlayerReadyMessage(BaseModel):
    shipPositions : dict[int, tuple[int, int]]  # ship ship length -> (row, col)


class PregameWSServerMessage(BaseModel):
    num_players_ready: int
    


