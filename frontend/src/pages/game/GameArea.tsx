import { useLoaderData } from "react-router-dom";
import { observer } from "mobx-react-lite";

import { ShipGrid, Ship, ShipPosition, GameArea as StyledGameArea, Timer } from "../../base";
import { useWebSocketStore } from "../../base";
import { GameViewLoaderData } from "../pregame/PreGameView";
import GameWebsocketStore, { TurnStatus } from "./GameWebsocket";
import { GameOverPopup } from "./GameOverPopup";


const GameArea = observer(() => {
    const { gameParams } = useLoaderData<GameViewLoaderData>();
    const WS = useWebSocketStore(GameWebsocketStore);

    let turnMessage;
    let colour;
    switch (WS.hasTurn) {
        case TurnStatus.YOUR_TURN:
            turnMessage = "Your turn";
            colour = "green";
            break;
        case TurnStatus.OPPONENT_TURN:
            turnMessage = "Opponent's turn";
            colour = "red";
            break;
        case TurnStatus.WAITING:
            turnMessage = "Waiting...";
            colour = "black";
            break;
        default:
            throw new Error(`Unknown turn status: ${WS.hasTurn}`);
    }


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
                {WS.gameOverStatus && <GameOverPopup result={WS.gameOverStatus} />}

                {WS.hasTurn == TurnStatus.YOUR_TURN &&
                    <Timer 
                        key={"shot-clock"} initialSeconds={15} 
                        onExpire={() => {
                            WS.sendShotMessage(WS.gameGrids!.opponentGameGrid.getRandomUntouchedCell()); 
                            WS.setHasTurn(TurnStatus.WAITING);}
                        } 
                        style={{position:"absolute", left:"calc(100% + 1rem)"}} 
                    />
                }

                <div style={{ display: "flex", justifyContent: "space-between", width: "100%" }}>
                    <WS.gameGrids.ownGameGrid.Renderer fleetPosition="left" opponent={false} />
                    <WS.gameGrids.opponentGameGrid.Renderer fleetPosition="right" opponent={true} />
                </div>
            </>
        );
    } 

    return (
        <>  
            <div style={{ color: colour }}>{turnMessage}</div>
            <br/>
            <StyledGameArea inert={WS.gameOverStatus !== null}>
                {gameArea}
            </StyledGameArea>
        </>
    )  

})

export default GameArea;