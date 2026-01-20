import { observer } from "mobx-react-lite"

import { BattleGrid } from "./BattleGrid/battle_grid"
import { ShipGarage } from "./Garage/garage"
import { useWebSocketStore } from "../../base"
import { PregameWebSocketStore } from "./PregameWebsocket"
import { PregameButtonBar } from "./buttons/button_bar"

const PregameActionArea: React.FC<{battleGrid: BattleGrid, shipGarage: ShipGarage}> = observer(({battleGrid, shipGarage}) => {

    
    const WS = useWebSocketStore(PregameWebSocketStore);    
    
    return (
        <div className="action-area" inert={WS.readyState.selfReady}>
            <PregameButtonBar battleGrid={battleGrid} shipGarage={shipGarage}/>
            <section className="game-area">
                <battleGrid.Renderer/>
                <shipGarage.Renderer/>
            </section>
        </div>
    );
})

export default PregameActionArea;