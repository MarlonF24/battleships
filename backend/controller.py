from fastapi import FastAPI, HTTPException, WebSocket
from fastapi import responses, staticfiles
from pydantic import BaseModel
from sqlmodel import create_engine, SQLModel, Field
from contextlib import asynccontextmanager


#TODO: Enable CORS in case we switch back to separate frontend server

class Player(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True, index=True) # Auto-incrementing primary key with nullable type

class Game(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True, index=True) 
    player1id: str
    player2id: str



DB_URL = "postgresql+psycopg2://postgres:12345678@localhost/battleships"

db_engine = create_engine(DB_URL, echo=True) 



@asynccontextmanager
async def lifespan(app: FastAPI):
    SQLModel.metadata.create_all(db_engine)
    
    yield
    # Shutdown code


app = FastAPI(lifespan=lifespan)

app.mount("/assets", staticfiles.StaticFiles(directory="frontend/dist/assets"), name="assets")


@app.get("/")
def welcome():

    return responses.FileResponse("frontend/dist/index.html")



@app.post("/create-game")
async def create_game():
    
    return {"message": "Game created successfully!"}



@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    while True:
        data = await websocket.receive_text()
        await websocket.send_text(f"Message text was: {data}")






