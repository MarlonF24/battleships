from __future__ import annotations
from uuid import UUID

from fastapi import FastAPI, HTTPException, WebSocket, Depends
from fastapi import responses, staticfiles, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlmodel import SQLModel, select, Session
from sqlalchemy.exc import IntegrityError
from contextlib import asynccontextmanager
from typing import Annotated

from backend.db import Game, Player 


from .db import *

db_engine = get_db_engine()


@asynccontextmanager
async def lifespan(app: FastAPI):
    SQLModel.metadata.drop_all(db_engine)  # for development purposes
    SQLModel.metadata.create_all(db_engine) 
    yield
    # Shutdown code


def get_session():
    with Session(db_engine) as session:
        yield session

SessionDependency = Annotated[Session, Depends(get_session)]


app = FastAPI(lifespan=lifespan)

origins = [
    "http://localhost:5173",
    "http://localhost:5174",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/assets", staticfiles.StaticFiles(directory="frontend/dist/assets"), name="assets")


@app.post("/create-player", status_code=status.HTTP_201_CREATED)
def create_player(session: SessionDependency, playerId: UUID = None) -> Player:
    print(playerId)
    if existing_player := session.exec(select(Player).where(Player.id == playerId)).first():
        print(f" Returning already existing player with ID {playerId}.")
        return existing_player
    
    player_instance = Player(id=playerId) # default_factory will create new uuid if None
    
    while True:  
        try:
            session.add(player_instance)
            session.commit()
            session.refresh(player_instance)
            print(f"Created player with ID: {player_instance.id}")
            break
        
        # catch unlikely uuid collision, other exceptions will propagate
        except IntegrityError as e:
            print(f"IntegrityError creating player: {e}")
            session.rollback()
            continue

    if not player_instance.id: 
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create player")
    
    print(f" Returning new player with ID {player_instance.id}.")
    return player_instance



class GameParams(BaseModel):
    battle_grid_rows: int
    battle_grid_cols: int
    ship_lengths: list[int]


@app.post("/create-game", status_code=status.HTTP_201_CREATED)
def create_game(playerId: UUID, request: GameParams, session: SessionDependency) -> UUID:
    game_instance = Game(battle_grid_rows=request.battle_grid_rows, battle_grid_cols=request.battle_grid_cols, ship_lengths=request.ship_lengths)
    session.add(game_instance)
    session.flush()

    if not game_instance.id:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create game")

    game_player_link = GamePlayerLink(game_id=game_instance.id, player_id=playerId, player_slot=1)
    session.add(game_player_link)
    
    session.commit()
    print(f"Created game with ID: {game_instance.id} for player ID: {playerId}")
    return game_instance.id


@app.post("/games/{gameId}/join", status_code=status.HTTP_204_NO_CONTENT)
def join_game(playerId: UUID, gameId: UUID, session: SessionDependency):
    game = session.get(Game, gameId)
    if not game:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Game not found")
    
    player = session.get(Player, playerId)

    if not player:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Player not found")
    
    try:
        session.add(GamePlayerLink(game_id=gameId, player_id=playerId, player_slot=2))
        session.commit()
    except IntegrityError:
        session.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unable to join game. It may be full or you are already joined.")
    


@app.get("/games/{gameId}/params", status_code=status.HTTP_200_OK)
def get_game_params(gameId: UUID, playerId: UUID, session: SessionDependency) -> GameParams:
    game = session.get(Game, gameId)
    if not game:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Game not found")
    
    if playerId not in map(lambda p: p.id, game.players):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Player not registered for this game")

    return GameParams(
        battle_grid_rows=game.battle_grid_rows, 
        battle_grid_cols=game.battle_grid_cols,
        ship_lengths=game.ship_lengths
    )


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    while True:
        data = await websocket.receive_text()
        await websocket.send_text(f"Message text was: {data}")


@app.get("/{full_path:path}") # catch all route
def welcome(full_path: str) -> responses.FileResponse:
    return responses.FileResponse("frontend/dist/index.html")



