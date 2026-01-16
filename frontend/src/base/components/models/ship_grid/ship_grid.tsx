
import { action, makeObservable, observable } from "mobx";
import { observer } from "mobx-react-lite";
import { Ship, ShipPosition } from "../ship/ship.js";
import { Grid } from "../grid/grid.js";


import "./ship_grid.css";
import { forwardRef } from "react";
import { socketModels } from "../../../api";

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

    constructor(readonly size: {rows: number; cols: number}, ships?: Map<ShipType, ShipPosition>) {
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
		if (ship.orientation === socketModels.Orientation.HORIZONTAL) {
			return headCol + ship.length <= this.size.cols;
		} else {
			return headRow + ship.length <= this.size.rows;
		}
	}


    canPlaceShip(ship: ShipLike, {headRow, headCol}: ShipPosition): boolean {
		// basic bounds
		if (headRow < 0 || headCol < 0) return false;

		if (!this.shipFitsBounds(ship, {headRow, headCol})) return false;

		if (!this.shipHasNoOverlap(ship, {headRow, headCol})) return false;

		return true;
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
                    <ship.Renderer position={position} onMouseDown={mouseDownHandlerFactory ? mouseDownHandlerFactory(ship) : undefined} />
                ))} 
                {children}
            </section>
        );
    }));
}