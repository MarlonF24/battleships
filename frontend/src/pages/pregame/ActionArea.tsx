import { observer } from "mobx-react-lite"

import { BattleGrid } from "./BattleGrid/BattleGrid"
import { ShipGarage } from "./Garage/Garage"
import { GameArea, useWebSocketStore } from "../../base"
import { PregameWebSocketStore } from "./PregameWebsocket"
import { PregameButtonBar } from "./buttons/button_bar"



const PregameActionArea: React.FC<{battleGrid: BattleGrid, shipGarage: ShipGarage}> = observer(({battleGrid, shipGarage}) => {
    const WS = useWebSocketStore(PregameWebSocketStore);    
    
    return (
        <div className="action-area" inert={WS.readyState.selfReady}>
            <PregameButtonBar battleGrid={battleGrid} shipGarage={shipGarage}/>
            <GameArea>
                <battleGrid.Renderer/>
                <shipGarage.Renderer/>
            </GameArea>
        </div>
    );
})

export default PregameActionArea;