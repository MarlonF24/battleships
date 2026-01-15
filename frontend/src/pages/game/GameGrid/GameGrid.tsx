import { makeAutoObservable, makeObservable } from "mobx";
import { ShipGrid, ShipPosition, Orientation, apiModels, socketModels } from "../../../base";
import HitGrid from "../HitGrid/HitGrid.js";
import ActiveShip from "../ActiveShip.js";
import FleetDisplay from "../FleetDisplay/FleetDisplay.js";


type ShipLengthsType = Map<number, number> | {[length: number]: number};

export class GameGrid {
    private readonly shipGrid: ShipGrid<ActiveShip>;
    private readonly hitGrid: boolean[][];
    private readonly fleetDisplay: FleetDisplay;

    constructor(size: {rows: number; cols: number}, shipLengths: ShipLengthsType, activeShips: ActiveShip[], hitPositions: boolean[][]) {
        const shipPositions = new Map(activeShips.map(ship => [ship, {headRow: ship.headRow, headCol: ship.headCol} as ShipPosition]));
        
        this.shipGrid = new ShipGrid(size, shipPositions);

        this.hitGrid = hitPositions;
        
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

        makeAutoObservable(this);
    } 
    
    static fromSocketModel(size: {rows: number; cols: number}, shipLengths: ShipLengthsType, view: socketModels.ShipGridView): GameGrid {
        const activeShips = view.ships.map(ship => ActiveShip.fromSocketModel(ship));
        
        const hitGrid = view.hitGrid.map(row => row.cells);

        return new GameGrid(
            size,
            shipLengths,
            activeShips,
            hitGrid
        );
    }


    get ships(): Map<ActiveShip, ShipPosition> {
        return this.shipGrid.ships;
    }

    hit (row: number, col: number): void {
        if (this.hitGrid[row][col]) {
            throw new Error(`Position (${row}, ${col}) has already been hit.`);
        }
        this.hitGrid[row][col] = true;

        const shipAtPosition = this.shipGrid.shipCells[row][col];
        
        if (shipAtPosition) {
            const shipIdx = shipAtPosition.orientation === Orientation.HORIZONTAL ? col - shipAtPosition.headCol : row - shipAtPosition.headRow;
            shipAtPosition.hit(shipIdx);
        }
    }


    readonly Renderer = ({fleetPosition}: {fleetPosition: "left" | "right"}, ) => {
        return (
            <section className="game-area">
                {fleetPosition === "left" && <this.fleetDisplay.Renderer />}
                
                <this.shipGrid.Renderer>
                    <HitGrid grid={this.hitGrid}/>
                </this.shipGrid.Renderer>

                {fleetPosition === "right" && <this.fleetDisplay.Renderer />}
            </section>
        );
    }

}