import React, { useCallback, useEffect } from "react";
import { useLoaderData } from "react-router-dom";

import { GameId, BackendWebSocket, OpponentConnection, socketModels } from "../../base";
import { GameGrid } from "./GameGrid/GameGrid.js";
import { GameViewLoaderData } from "../pregame";
import { Page, useSwitchView } from "../../routing/switch_view";


const GameView: React.FC = () => {
    const { gameParams, gameId } = useLoaderData<GameViewLoaderData>();

    const switchView = useSwitchView();

    const [websocketConnected, setWebsocketConnected] = React.useState(false);
    
    const [ownGrid, setOwnGrid] = React.useState<GameGrid>(null!);

    const [opponentGrid, setOpponentGrid] = React.useState<GameGrid>(null!);

    
    
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
    
    const handleServerShotResultMessage = useCallback((message: socketModels.GameServerShotResultMessage) => {
        ownGrid.hit(message.row, message.column);
    }, []);
    
    
    const gameWSOnMessage = useCallback((message: socketModels.ServerMessage) => {
        const outerPayload = message.payload;
        if (outerPayload.case === "gameMessage") {
            const innerPayload = outerPayload.value;
            const innerPayloadCase = innerPayload.payload.case;
            
            if (innerPayloadCase === "gameState") {
                const gameState = innerPayload.payload.value;
                handleServerStateMessage(gameState);
            } else if (innerPayloadCase === "shotResult") { 
                handleServerShotResultMessage(innerPayload.payload.value);
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
    }, [gameId]);



    if (!websocketConnected) {
        return <div>Connecting to pregame server...</div>;
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