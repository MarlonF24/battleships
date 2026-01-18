
import { action, makeObservable, observable } from "mobx";
import { observer } from "mobx-react-lite";
import { Ship, ShipPosition } from "../Ship/Ship.js";
import { Grid } from "../Grid/Grid.js";


import "./ShipGrid.css";
import { forwardRef } from "react";
import { socketModels } from "../../../api/index.js";

type mouseDownHandler = (event: React.MouseEvent<HTMLDivElement>) => void;

export interface ShipLike {
    readonly length: number;
	orientation: socketModels.Orientation;
}

type mouseDownHandlerFactory = (ship: Ship) => mouseDownHandler;
interface ShipGridRendererProps {
    mouseDownHandlerFactory?: mouseDownHandlerFactory;
    children?: React.ReactNode;
}

export class ShipGrid<ShipType extends Ship = Ship> {
    ships: Map<ShipType, ShipPosition>;
    shipCells: (ShipType | null)[][];   

    constructor(readonly size: {rows: number; cols: number}, ships?: Map<ShipType, ShipPosition>, protected readonly requireGaps: boolean = true) {
        this.ships = ships ?? new Map();
        this.shipCells = Array.from({ length: size.rows }, () => Array(size.cols).fill(null));

        for (const [ship, position] of this.ships.entries()) {
            this.placeShip(ship, position);
        }

        makeObservable(this, {
            ships: observable.shallow,
            shipCells: observable.shallow,
            placeShip: action,
            removeShip: action,
            clear: action
        });
    }

    containsShip(ship: ShipType): boolean {
        return this.ships.has(ship);
    }


    shipFitsBounds(
		ship: ShipLike,
		{headRow, headCol }: ShipPosition = {headRow: 0, headCol: 0}
	): boolean {
        if (headRow < 0 || headCol < 0) return false;

		if (ship.orientation === socketModels.Orientation.HORIZONTAL) {
			return headCol + ship.length <= this.size.cols;
		} else {
			return headRow + ship.length <= this.size.rows;
		}
	}


    canPlaceShip(ship: ShipLike, {headRow, headCol}: ShipPosition, disregard?: Ship): boolean {
		if (!this.shipFitsBounds(ship, {headRow, headCol})) return false;

		if (!this.shipHasNoOverlap(ship, {headRow, headCol}, disregard)) return false;

        if (this.requireGaps) {
            if (this.getShipSurroundingCoords(ship, {headRow, headCol}).some(({row, col}) => {
                return this.shipCells[row][col] !== null && this.shipCells[row][col] !== disregard;
            })) {
                return false;
            }
        }

		return true;
	}

    private static shipCoordRanges(
        ship: ShipLike,
        {headRow, headCol}: ShipPosition
    ) {
        return ship.orientation === socketModels.Orientation.HORIZONTAL
        ? {row: [headRow, headRow], col: [headCol, headCol + ship.length - 1]}
        : {row: [headRow, headRow + ship.length - 1], col: [headCol, headCol]}
        ;
    }

    shipCoords(ship: ShipLike,position: ShipPosition) {
        return new Set(Array.from({length: ship.length}, (_, i) => {
            return ship.orientation === socketModels.Orientation.HORIZONTAL
                ? {row: position.headRow, col: position.headCol + i}
                : {row: position.headRow + i, col: position.headCol};
        }));
    }
    
    getShipSurroundingCoords(ship: ShipLike, {headRow, headCol}: ShipPosition) {
        const shipCoordRanges = ShipGrid.shipCoordRanges(ship, {headRow, headCol});
        const shipCoords = this.shipCoords(ship, {headRow, headCol});

        const coords = [];

        for (let row = shipCoordRanges.row[0] - 1; row <= shipCoordRanges.row[1] + 1; row++) {
            
            for (let col = shipCoordRanges.col[0] - 1; col <= shipCoordRanges.col[1] + 1; col++) {
    
                // boundary check
                if (row < 0 || row >= this.size.rows || col < 0 || col >= this.size.cols) {
                    continue;
                }

                if (shipCoords.has({row, col})) {
                    continue;
                }

                
                coords.push({row, col});
            }
        }
        return coords;
    }

	shipHasNoOverlap(
		ship: ShipLike,
		{headRow, headCol}: ShipPosition,
		disregard?: Ship
	): boolean {
		if (ship.orientation === socketModels.Orientation.HORIZONTAL) {
			for (let c = headCol; c < headCol + ship.length; c++) {
				const cell = this.shipCells[headRow][c];
				if (cell && cell !== disregard) {
					return false;
				}
			}
		} else {
			for (let r = headRow; r < headRow + ship.length; r++) {
				const cell = this.shipCells[r][headCol];
				if (cell && cell !== disregard) {
					return false;
				}
			}
		}

		return true;
	}


    placeShip(ship: ShipType, position: ShipPosition): void {
        if (!this.canPlaceShip(ship, position))
            throw new RangeError("cannot place ship");
        
        const {headRow, headCol} = position;
        if (ship.orientation === socketModels.Orientation.HORIZONTAL) {
            for (let c = headCol; c < headCol + ship.length; c++) {
                this.shipCells[headRow][c] = ship;
            }
        } else {
            for (let r = headRow; r < headRow + ship.length; r++) {
                this.shipCells[r][headCol] = ship;
            }
        }

        this.ships.set(ship, position);
    }

    removeShip(ship: ShipType): void {
        if (!this.containsShip(ship)) throw new Error("Tried to remove ship not in grid");

        const {headRow, headCol} = this.ships.get(ship)!;

        if (ship.orientation === socketModels.Orientation.HORIZONTAL) {
            for (let c = headCol; c < headCol + ship.length; c++) {
                this.shipCells[headRow][c] = null;
            }
        } else {
            for (let r = headRow; r < headRow + ship.length; r++) {
                this.shipCells[r][headCol] = null;
            }       
        }

        this.ships.delete(ship);
    }

    clear() {
		this.ships.forEach((_, ship) => {this.removeShip(ship);})
	}

    

    public readonly Renderer = observer(forwardRef<HTMLElement, ShipGridRendererProps>(({mouseDownHandlerFactory, children}, ref) => {
       
        return (
            <section className="ship-grid" ref={ref}>
                <Grid rows={this.size.rows} cols={this.size.cols}/>
                {Array.from(this.ships.entries()).map(([ship, position]) => (
                    <ship.Renderer key={position.headRow + "-" + position.headCol} position={position} onMouseDown={mouseDownHandlerFactory ? mouseDownHandlerFactory(ship) : undefined} />
                ))} 
                {children}
            </section>
        );
    }));
}