import React, { useState } from "react";
import { useLoaderData } from "react-router-dom";

import { GameId, Ship, WebSocketProvider } from "../../base";
import GameWebsocketStore from "./GameWebsocket";
import { GameViewLoaderData } from "../pregame";
import { useSwitchView } from "../../routing/switch_view";
import { ShipGrid, ShipPosition } from "../../base";


const GameView: React.FC = () => {
    const { gameParams, gameId } = useLoaderData<GameViewLoaderData>();

    const switchView = useSwitchView();

    const [WS] = useState(() => new GameWebsocketStore(gameId, switchView, gameParams));
   
    let gameArea = <></>;
    if (!WS.gameGrids) {
        // Fallback to local rendering while before game state with hitgrids is received from websocket

        const { battleGridRows: rows, battleGridCols: cols } = gameParams;
        const ownShips = new Map<Ship, ShipPosition>(gameParams.ownShips.map(ship => [new Ship(ship.length!, ship.orientation!), {headRow: ship.headRow!, headCol: ship.headCol!}])); 

        const ownGrid = new ShipGrid({rows, cols}, ownShips);
        const opponentGrid = new ShipGrid({rows, cols});
        
        gameArea = (<>
            <ownGrid.Renderer />
            <opponentGrid.Renderer />
        </>);

    } else {
        gameArea = (
            <>
                <WS.gameGrids.ownGameGrid.Renderer fleetPosition="left" opponent={false} />
                <WS.gameGrids.opponentGameGrid.Renderer fleetPosition="right" opponent={true} />
            </>
        );
    } 

    return (
        <> 
            <GameId gameId={gameId}/> 
            <WebSocketProvider store={WS}>
                <section className="game-area">
                    {gameArea}
                </section> 
            </WebSocketProvider>
        </>
    );

}

export default GameView;