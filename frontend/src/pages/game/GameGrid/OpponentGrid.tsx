import GameGrid, { ShipLengthsType } from "./GameGrid";
import { HitState, HitStateType } from "../HitGrid/HitGrid";
import ActiveShipLogic from "../ActiveShipLogic.js";
import { makeObservable, override } from "mobx";

class OpponentGrid extends GameGrid {

    constructor(
        size: {rows: number; cols: number}, 
        shipLengths: ShipLengthsType, 
        activeShips: ActiveShipLogic[], 
        protected readonly hitGrid: HitStateType[][]
    ) {
        super(size, shipLengths, activeShips, hitGrid);

        makeObservable(this, {
            hit: override,
            addShip: true,
        })

    }

    override hit(row: number, col: number, isHit?: boolean): void {
        if (this.hitGrid[row][col] !== HitState.UNTOUCHED) {
            throw new Error(`Position (${row}, ${col}) has already been hit.`);
        }

        if (this.shipGrid.shipCells[row][col]) {
            throw new Error(`Tried to hit opponent's grid where a ship is already located at (${row}, ${col}). This statement can only be reached if the cell is marked as UNTOUCHED, which is inconsistent.`);
        }

        this.hitGrid[row][col] = isHit ? HitState.HIT : HitState.MISS;
    }

    addShip (ship: ActiveShipLogic): void {
        const {headRow, headCol} = ship;
        
        if (!this.shipGrid.canPlaceShip(ship, {headRow, headCol})) {
            throw new Error(`Cannot place ship ${ship} at position (${headRow}, ${headCol}).`);
        }
        
        const shipCoordList = Array.from(this.shipGrid.shipCoords(ship, {headRow, headCol}));
        if (shipCoordList.some(({row, col}) => this.hitGrid[row][col] !== HitState.HIT)) {
            throw new Error(`Cannot place ship ${ship} at position (${headRow}, ${headCol}) because it overlaps with unhit positions.`);
        }

    
        // mark surrounding cells as impossible if they are untouched
        for (const {row, col} of this.shipGrid.getShipSurroundingCoords(ship, {headRow, headCol})) {
            {
                if (this.hitGrid[row][col] === HitState.UNTOUCHED) {
                    this.hitGrid[row][col] = HitState.IMPOSSIBLE;
                }
            }
        }
        

        this.shipGrid.placeShip(ship, {headRow, headCol});

        this.fleetDisplay.addActiveShip(ship);
    }

}

export default OpponentGrid;