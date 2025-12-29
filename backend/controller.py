from __future__ import annotations
from uuid import UUID

from fastapi import FastAPI, HTTPException, WebSocket, Depends
from fastapi import responses, staticfiles
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


@app.get("/")
def welcome() -> responses.FileResponse:
    return responses.FileResponse("frontend/dist/index.html")



@app.post("/create-player", status_code=201)
def create_player(session: SessionDependency, playerId: UUID = None) -> Player:
    
    if existing_player := session.exec(select(Player).where(Player.id == playerId)).first():
        return existing_player
    
    player_instance = Player(id=playerId) # default_factory will create new uuid if None
    
    for _ in range(3):  # max 3 attempts
        try:
            session.add(player_instance)
            session.commit()
            session.refresh(player_instance)
            print(f"Created player with ID: {player_instance.id}")
            break
        
        # catch unlikely uuid collision
        except IntegrityError as e:
            print(f"IntegrityError creating player: {e}")
            session.rollback()
            continue

    if not player_instance.id: 
        raise HTTPException(status_code=500, detail="Failed to create player")
    
    return player_instance



@app.post("/create-game", status_code=201)
def create_game(playerId: UUID, session: SessionDependency) -> Game:
    game_instance = Game()
    session.add(game_instance)
    session.flush()

    if not game_instance.id:
        raise HTTPException(status_code=500, detail="Failed to create game")

    game_player_link = GamePlayerLink(game_id=game_instance.id, player_id=playerId, player_slot=1)
    session.add(game_player_link)
    
    session.commit()

    return game_instance


@app.post("/{gameId}/join", status_code=200)
def join_game(playerId: UUID, gameId: UUID, session: SessionDependency) -> Game:
    game = session.get(Game, gameId)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    
    player = session.get(Player, playerId)

    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
    
    session.add(GamePlayerLink(game_id=gameId, player_id=playerId, player_slot=2))

    session.commit()

    return game



@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    while True:
        data = await websocket.receive_text()
        await websocket.send_text(f"Message text was: {data}")






