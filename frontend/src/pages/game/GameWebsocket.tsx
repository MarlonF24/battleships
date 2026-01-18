import { observable, makeObservable } from "mobx";
import { create } from "@bufbuild/protobuf";

import { apiModels, socketModels, WebSocketStore, MessagePayload } from "../../base";
import { Page, useSwitchView } from "../../routing/switch_view";
import GameGrid from "./GameGrid/GameGrid";
import OpponentGrid from "./GameGrid/OpponentGrid";
import ActiveShipLogic from "./ActiveShipLogic";

class GameWebsocketStore extends WebSocketStore {
    gameGrids: {ownGameGrid: GameGrid, opponentGameGrid: OpponentGrid} | null = null;
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
                this.handleServerStateMessage(message.payload.value);
                break;
            case "turn":
                this.handleServerTurnMessage(message.payload.value);
                break;
            case "shotResult":
                throw Error("ShotResult handling not fully implemented yet. Must write logic to disambiguate own vs opponent shot results.");
                // this.handleServerShotResultMessage(message.payload.value);
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

            const opponentGrid = OpponentGrid.fromSocketModel(
                {rows: this.gameParams.battleGridRows, cols: this.gameParams.battleGridCols},
                this.gameParams.shipLengths,
                opponentnGridView
            )

            this.gameGrids = {ownGameGrid: ownGrid, opponentGameGrid: opponentGrid};
        
    }
        
        
    handleServerShotMessage = (message: socketModels.GameServerShotMessage) => {
        if (!this.gameGrids) throw new Error("Trying to process shot but game grids not initialized.");
        
        const {row, column} = message;
        this.gameGrids.ownGameGrid.hit(row, column);
    }

    handleServerShotResultMessage = (message: socketModels.GameServerShotResultMessage) => {
        if (!this.gameGrids) throw new Error("Trying to shoot but game grids not initialized.");    

        const {row, column} = message.shot!;

        this.gameGrids.opponentGameGrid.hit(row, column, message.isHit);

        if (message.sunkShip) {
            this.gameGrids.opponentGameGrid.addShip(ActiveShipLogic.fromSocketModel(message.sunkShip));
        }

    }
        
    handleServerTurnMessage = (message: socketModels.GameServerTurnMessage) => {
        if (this.hasTurn) throw new Error("Received turn message but it's already player's turn.");
        
        this.hasTurn = true;
    };

    sendGamePlayerMessage = <T extends MessagePayload<socketModels.GamePlayerMessage>>(message: T): void => {
        const wrappedMessage = create(socketModels.GamePlayerMessageSchema, {
            payload: message
        });
        console.log("Sending game player message:", message);
        this.sendPlayerMessage({case: "gameMessage", value: wrappedMessage});
    }

}

export default GameWebsocketStore;