import React, { useCallback, useEffect, use, useState, useEffectEvent } from "react";
import { useLoaderData } from "react-router-dom";

import { GameId, BackendWebSocket, OpponentConnection, socketModels } from "../../base";
import { GameGrid } from "./GameGrid/GameGrid.js";
import { GameViewLoaderData } from "../pregame";
import { Page, useSwitchView } from "../../routing/switch_view";



const GameView: React.FC = () => {
    const { gameParams, gameId } = useLoaderData<GameViewLoaderData>();

    const switchView = useSwitchView();

    const [websocketConnected, setWebsocketConnected] = React.useState(false);

    const [ownGrid, setOwnGrid] = React.useState<GameGrid | null>(null);
    const [opponentGrid, setOpponentGrid] = React.useState<GameGrid | null>(null);
    
    
    

    const handleServerStateMessage = useCallback((message: socketModels.GameServerStateMessage) => {
        const ownGridView = message.ownGrid!;
        const opponentnGridView = message.opponentGrid!;
        
        setOwnGrid(GameGrid.fromSocketModel(
            {rows: gameParams.battleGridRows, cols: gameParams.battleGridCols},
            gameParams.shipLengths,
            ownGridView
        ));
        setOpponentGrid(GameGrid.fromSocketModel(
            {rows: gameParams.battleGridRows, cols: gameParams.battleGridCols},
            gameParams.shipLengths,
            opponentnGridView
        ));
    
    }, []);
    
    
    const handleServerShotResultMessage = useEffectEvent((message: socketModels.GameServerShotResultMessage) => {
        ownGrid!.hit(message.row, message.column);
    });
    
    const handleServerTurnMessage = useCallback((message: socketModels.GameServerTurnMessage) => {
    
    }, []);
    
    const gameWSOnMessage = useCallback((message: socketModels.ServerMessage) => {
        const outerPayload = message.payload;
        if (outerPayload.case === "gameMessage") {
            const innerPayload = outerPayload.value;
            const innerPayloadCase = innerPayload.payload.case;
            
            switch (innerPayloadCase) {
                case "gameState":
                    handleServerStateMessage(innerPayload.payload.value);
                    break;
                case "turn":
                    handleServerTurnMessage(innerPayload.payload.value);
                    break
                case "shotResult":
                    handleServerShotResultMessage(innerPayload.payload.value);
                    break;
                
            }
        }
    }, []);
    
    
    
    useEffect(() => {
        setWebsocketConnected(false);
        const ws = BackendWebSocket.connect(
            Page.GAME,
            gameId,
            sessionStorage.getItem("playerId")!,
            {
                onMessage: gameWSOnMessage,
                onOpen: () => setWebsocketConnected(true),
                onClose: () => switchView(Page.ERROR, gameId, "Connection to game server lost."),
            }
        );


        return () => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.onclose = () => console.log("Game WebSocket closed");
                ws.close();
            }
        };
    }, [gameParams, gameId]);



    if (!websocketConnected) {
        return <div>Connecting to server...</div>;
    }

    if (!ownGrid || !opponentGrid) {
        return <div>Loading game grids...</div>;
    }


    return (
        <> 
            <GameId gameId={gameId}/> 
            <OpponentConnection />
            <br/>
            <ownGrid.Renderer fleetPosition="left"/>
            <opponentGrid.Renderer fleetPosition="right"/>
        </>
    );

}

export default GameView;