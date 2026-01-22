import { observable, makeObservable } from "mobx";
import { create } from "@bufbuild/protobuf";

import { apiModels, socketModels, WebSocketStore, MessagePayload } from "../../base";
import { Page, useSwitchView } from "../../routing/switch_view";
import GameGrid from "./GameGrid/GameGrid";
import OpponentGrid from "./GameGrid/OpponentGrid";
import ActiveShipLogic from "./ActiveShipLogic";

export enum TurnStatus {
    WAITING = "waiting",
    YOUR_TURN = "your_turn",
    OPPONENT_TURN = "opponent_turn"
}


class GameWebsocketStore extends WebSocketStore {
    gameGrids: {ownGameGrid: GameGrid, opponentGameGrid: OpponentGrid} | null = null;
    hasTurn: TurnStatus = TurnStatus.WAITING;
    gameOverStatus: socketModels.GameOverResult | null = null;

    constructor(gameId: string, navigation: ReturnType<typeof useSwitchView>, protected readonly gameParams: apiModels.GameParams) {
        super(Page.GAME, gameId, navigation);
        this.registerHandler("gameMessage", this.handleGameServerMessage);

        makeObservable(this, {
            gameGrids: observable.shallow,
            hasTurn: observable,
            gameOverStatus: observable,
            handleServerStateMessage: true,
            handleServerTurnMessage: true,
            handleServerShotResultMessage: true,
            handleGameOver: true,
            setHasTurn: true
        });
    }

    setHasTurn = (turnStatus: TurnStatus) => {
        this.hasTurn = turnStatus;
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
            case "shot":
                this.handleServerShotMessage(message.payload.value);
                break;
            case "shotResult":
                this.handleServerShotResultMessage(message.payload.value);
                break;
            case "gameOver":
                this.handleGameOver(message.payload.value);
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
        if (this.hasTurn === TurnStatus.YOUR_TURN && !message.opponentsTurn) throw new Error("Received turn message but it's already player's turn.");
        
        this.hasTurn = message.opponentsTurn ? TurnStatus.OPPONENT_TURN : TurnStatus.YOUR_TURN;
    };

    handleGameOver = (message: socketModels.GameServerGameOverMessage): void => {
        this.gameOverStatus = message.result;
        this.intentionalDisconnect(); 
    }

    sendGamePlayerMessage = <T extends MessagePayload<socketModels.GamePlayerMessage>>(message: T): void => {
        const wrappedMessage = create(socketModels.GamePlayerMessageSchema, {
            payload: message
        });
        console.log("Sending game player message:", message);
        this.sendPlayerMessage({case: "gameMessage", value: wrappedMessage});
    }

    sendShotMessage = ({row, col:column}:{row: number, col: number}) => {
        const shotMessage = create(socketModels.GamePlayerShotMessageSchema, {row, column});

        console.log(`Shot detected at ${row}, ${column}. Sending shot message:`, shotMessage, "Toggling turn in frontend");
        
        this.setHasTurn(TurnStatus.WAITING); 
        
        this.sendGamePlayerMessage({case: "shot", value: shotMessage});
    };

}

export default GameWebsocketStore;