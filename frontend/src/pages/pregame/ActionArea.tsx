import { useCallback } from "react"
import { observer } from "mobx-react-lite"

import { BattleGrid } from "./BattleGrid/BattleGrid"
import { ShipGarage } from "./Garage/Garage"
import { GameArea, useWebSocketStore, Timer } from "../../base"
import { PregameWebSocketStore } from "./PregameWebsocket"
import { PregameButtonBar } from "./buttons/ButtonBar"
import { generateRandomBoard } from "./buttons/random_grid"



const PregameActionArea: React.FC<{battleGrid: BattleGrid, shipGarage: ShipGarage}> = observer(({battleGrid, shipGarage}) => {
    const WS = useWebSocketStore(PregameWebSocketStore);    
    
    const renderTimer: boolean = !WS.readyState.selfReady && WS.readyState.numReadyPlayers > 0;

    const onExpire = useCallback(() => {

        generateRandomBoard(battleGrid, shipGarage, false);
        WS.sendPlayerReadyMessage(battleGrid);

    }, [battleGrid, shipGarage, WS]);


    return (
        <div className="action-area" inert={WS.readyState.selfReady} style={{position:"relative"}}>
            {renderTimer && <Timer initialSeconds={40} onExpire={onExpire} style={{position:"absolute", right:"calc(100% + 1rem)"}} />}
            <PregameButtonBar battleGrid={battleGrid} shipGarage={shipGarage}/>
            <GameArea>
                <battleGrid.Renderer/>
                <shipGarage.Renderer/>
            </GameArea>
        </div>
    );
})

export default PregameActionArea;