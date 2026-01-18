import { useLoaderData } from "react-router-dom";

import { ShipGrid, Ship, ShipPosition } from "../../base";
import { useWebSocketStore } from "../../base";
import { GameViewLoaderData } from "../pregame/view";
import GameWebsocketStore from "./GameWebsocket";
import { observer } from "mobx-react-lite";

const GameArea = observer(() => {
    const { gameParams } = useLoaderData<GameViewLoaderData>();
    const WS = useWebSocketStore(GameWebsocketStore);

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
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>  
                <div style={{ color: WS.hasTurn ? "green" : "red" }}>{WS.hasTurn ? "Your turn" : "Opponent's turn"}</div>
                <br/>
                <div style={{ display: "flex", justifyContent: "space-between", width: "100%" }}>
                    <WS.gameGrids.ownGameGrid.Renderer fleetPosition="left" opponent={false} />
                    <WS.gameGrids.opponentGameGrid.Renderer fleetPosition="right" opponent={true} />
                </div>
            </div>
        );
    } 

    return (
        <section className="game-area">
            {gameArea}
        </section>
    )  

})

export default GameArea;