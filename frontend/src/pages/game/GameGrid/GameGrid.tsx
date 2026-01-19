import { makeObservable } from "mobx";
import { ShipGrid, ShipPosition, socketModels, useWebSocketStore } from "../../../base";
import HitGrid, {HitState, HitStateType} from "../HitGrid/HitGrid.js";
import ActiveShipLogic from "../ActiveShipLogic.js";
import FleetDisplay from "../FleetDisplay/FleetDisplay.js";

import "./GameGrid.css";
import GameWebsocketStore from "../GameWebsocket.js";
import { Constructor } from "protobufjs";


export type ShipLengthsType = Map<number, number> | {[length: number]: number};

class GameGrid {
    protected readonly shipGrid: ShipGrid<ActiveShipLogic>;
    protected readonly fleetDisplay: FleetDisplay;

    constructor(
        size: {rows: number; cols: number}, 
        shipLengths: ShipLengthsType, 
        activeShips: ActiveShipLogic[], 
        protected readonly hitGrid: HitStateType[][]) {
        const shipPositions = new Map(activeShips.map(ship => [ship, {headRow: ship.headRow, headCol: ship.headCol} as ShipPosition]));
        
        this.shipGrid = new ShipGrid(size, shipPositions);

        this.hitGrid = hitGrid;
        
        let shipLengthsMap: Map<number, number>;
        if (shipLengths instanceof Map) {
            shipLengthsMap = shipLengths;
        } else {
            shipLengthsMap = new Map(Object.entries(shipLengths).map(([lengthStr, count]) => [parseInt(lengthStr), count]));
        }


        this.fleetDisplay = new FleetDisplay(
            shipLengthsMap,
            activeShips
        );

        makeObservable<GameGrid, "hitGrid">(this,{
            hitGrid: true,
            hit: true,
        });
    } 
    
    static fromSocketModel<T extends GameGrid>(this: Constructor<T>, size: {rows: number; cols: number}, shipLengths: ShipLengthsType, view: socketModels.ShipGridView): T {
        const activeShips = view.ships.map(ship => ActiveShipLogic.fromSocketModel(ship));
        
        const hitGrid = view.hitGrid.map(row => row.cells);

        return new this(
            size,
            shipLengths,
            activeShips,
            hitGrid
        );
    }


    get ships(): Map<ActiveShipLogic, ShipPosition> {
        return this.shipGrid.ships;
    }

    hit (row: number, col: number): void {
        if (this.hitGrid[row][col] !== HitState.UNTOUCHED) {
            throw new Error(`Position (${row}, ${col}) has already been hit.`);
        }

        
        const shipAtPosition = this.shipGrid.shipCells[row][col];
        
        if (shipAtPosition) {
            this.hitGrid[row][col] = HitState.HIT;
            
            const shipIdx = shipAtPosition.orientation === socketModels.Orientation.HORIZONTAL ? col - shipAtPosition.headCol : row - shipAtPosition.headRow;
            shipAtPosition.hit(shipIdx);
           
        } else {
            this.hitGrid[row][col] = HitState.MISS;
        }
    }

   



    readonly Renderer = ({fleetPosition, opponent}: {fleetPosition: "left" | "right", opponent: boolean} ) => {
        const WS = useWebSocketStore(GameWebsocketStore);
        
        return (
            <section className="game-grid">
                {fleetPosition === "left" && <this.fleetDisplay.Renderer />}
                
                <div style={WS.hasTurn !== opponent ? {opacity: 0.6} : {opacity: 1}}>
                    <this.shipGrid.Renderer>
                        <HitGrid grid={this.hitGrid} shootable={opponent} />
                    </this.shipGrid.Renderer>
                </div>

                {fleetPosition === "right" && <this.fleetDisplay.Renderer />}
            </section>
        );
    }

}

export default GameGrid;