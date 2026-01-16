import { observable, makeObservable } from "mobx";

import { apiModels, socketModels, WebSocketStore } from "../../base";
import { Page, useSwitchView } from "../../routing/switch_view";
import { GameGrid } from "./GameGrid/GameGrid";

class GameWebsocketStore extends WebSocketStore {
    gameGrids: {ownGameGrid: GameGrid, opponentGameGrid: GameGrid} | null = null;
    hasTurn: boolean = false; 

    constructor(gameId: string, navigation: ReturnType<typeof useSwitchView>, protected readonly gameParams: apiModels.GameParams) {
        super(Page.GAME, gameId, navigation);
        this.registerHandler("gameMessage", this.handleGameServerMessage);

        makeObservable(this, {
            gameGrids: observable.shallow,
            handleServerStateMessage: true,
            handleServerTurnMessage: true,
            handleServerShotResultMessage: true,
        });
    }


    handleGameServerMessage = (message: socketModels.GameServerMessage) => {
        console.log("Received game server message:", message);
        switch (message.payload.case) {
            case "gameState":
                // Handle game state update
                break;
            case "turn":
                // Handle turn notification
                break;
            case "shotResult":
                // Handle general message
                break;
            default:
                console.error(`Unhandled game server message type ${message.payload.case} message:${message}`);
        }
    }


     handleServerStateMessage = (message: socketModels.GameServerStateMessage) => {
            const ownGridView = message.ownGrid!;
            const opponentnGridView = message.opponentGrid!;
            
            const ownGrid = GameGrid.fromSocketModel(
                {rows: this.gameParams.battleGridRows, cols: this.gameParams.battleGridCols},
                this.gameParams.shipLengths,
                ownGridView
            )

            const opponentGrid = GameGrid.fromSocketModel(
                {rows: this.gameParams.battleGridRows, cols: this.gameParams.battleGridCols},
                this.gameParams.shipLengths,
                opponentnGridView
            )

            this.gameGrids = {ownGameGrid: ownGrid, opponentGameGrid: opponentGrid};
        
    }
        
        
    handleServerShotResultMessage = (message: socketModels.GameServerShotResultMessage) => {
        if (!this.gameGrids) throw new Error("Trying to shoot but game grids not initialized.");    

        this.gameGrids.ownGameGrid.hit(message.row, message.column);
    }
        
    handleServerTurnMessage = (message: socketModels.GameServerTurnMessage) => {
        if (this.hasTurn) throw new Error("Received turn message but it's already player's turn.");
        
        this.hasTurn = true;
    };

}

export default GameWebsocketStore;