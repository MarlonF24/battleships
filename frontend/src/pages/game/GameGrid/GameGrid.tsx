import { makeAutoObservable, makeObservable } from "mobx";
import { ShipGrid, ShipPosition, Orientation, apiModels } from "../../../base";
import HitGrid from "../HitGrid/HitGrid.js";
import ActiveShip from "../ActiveShip.js";
import FleetDisplay from "../FleetDisplay/FleetDisplay.js";


export class GameGrid {
    private readonly shipGrid: ShipGrid<ActiveShip>;
    private readonly hitGrid: boolean[][];
    private readonly fleetDisplay: FleetDisplay;

    constructor(size: {rows: number; cols: number}, shipLengths: Map<number, number>, activeShips: ActiveShip[], hitPositions: boolean[][]) {
        const shipPositions = new Map(activeShips.map(ship => [ship, {headRow: ship.headRow, headCol: ship.headCol} as ShipPosition]));
        
        this.shipGrid = new ShipGrid(size, shipPositions);

         if (Array.isArray(hitPositions)) {
            this.hitGrid = hitPositions;
        } else {
            this.hitGrid = Array.from({ length: size.rows }, () => Array(size.cols).fill(false));
        }

        this.fleetDisplay = new FleetDisplay(
            shipLengths,
            activeShips
        );

        makeAutoObservable(this);
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


    readonly Renderer = ({fleetPosition}: {fleetPosition: "left" | "right"}) => {
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