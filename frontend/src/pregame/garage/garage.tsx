import { Ship, Orientation } from "../ship/ship.js";
import { Grid } from "../grid/grid.js";
import { ShipGrid } from "../utility/ship_grid.js";

import "./garage.css";

export class ShipGarage extends ShipGrid {
	public readonly shipInHandler: EventListener = new SuggestionHandler(this).suggestShip;
	
	readonly shipArray: (Ship | null)[];
	readonly maxLen: number;

	constructor(ships: Ship[]) {
		super(
			new Grid(
				ships.length,
				Math.max(...ships.map((s) => (typeof s === 'number' ? s : s.length)), 1)
			)
		);
		
		this.ships = new Map(ships.map((ship, index) => [ship, { headRow: index, headCol: 0 }]));
		
		this.shipArray = Array.from(ships);

		this.maxLen = this.grid.cols;

		sessionStorage.setItem(
			"initial-garage",
			JSON.stringify((ships as Ship[]).map((s) => s.length))
		);
	}

	reset() { // !! only call this when removing all ships !!
		this.ships.forEach((_, ship) => {
			this.removeShip(ship);
		});

		if (document.getElementsByClassName("ship").length) {throw new Error("Ships still present in game outside the garage, cant reset the garage to initial ships");}
		
		const initialShips = JSON.parse(sessionStorage.getItem("initial-garage")!);

		initialShips.forEach((length: number, index: number) => {
			this.placeShip(new Ship(length, Orientation.HORIZONTAL), {headRow: index});
		});
	}

	clear() {
		this.ships.forEach((_, ship) => {this.removeShip(ship);})
	}
	

	rowInBounds(row: number, err_msg?: string): boolean {
		if (row >= this.shipArray.length || row < 0) {
			if (err_msg) throw new RangeError(err_msg);
			else return false;
		}
		return true;
	}

	shipFits(ship: Ship, err_msg?: string): boolean {
		if (ship.length > this.maxLen) {
			if (err_msg) throw new RangeError(err_msg);
			else return false;
		}
		return true;
	}

	rowEmpty(row: number, disregard?: Ship): boolean {
		if (!this.rowInBounds(row)) return false;
		return this.shipArray[row] == null || this.shipArray[row] === disregard;
	}

	canPlaceShip(row: number, ship: Ship): boolean {
		if (!this.shipFits(ship)) return false;
		return this.rowEmpty(row);
	}

	containsShip(ship: Ship): boolean {
		return this.ships.has(ship);
	}

	removeShip(ship: Ship) {
		if (!this.containsShip(ship)) throw new Error("Ship not in garage");

		let { headRow } = this.ships.get(ship)!;

		this.shipArray[headRow] = null;
		this.ships.delete(ship!);
	}

	placeShip( ship: Ship, {headRow, headCol = 0}: {headRow: number, headCol?: number} ): void {
		if (!this.canPlaceShip(headRow, ship))
			throw new Error(`Cannot place ship at ${headRow} in garage`);

		if (ship.orientation != Orientation.HORIZONTAL) throw new Error("Cannot place non-horizontal ship in garage"); 

		this.shipArray[headRow] = ship;
		this.ships.set(ship, {headRow, headCol});
	}
}

import {
	BaseSuggestionHandler,
	BaseSuggestionState,
	ShipInEventDetail,
} from "../utility/suggestion_handler.js";

interface GarageSuggestionState extends BaseSuggestionState {
	currentRow: {
		readonly rowIdx: number;
		readonly element: HTMLTableRowElement;
	};
}

class SuggestionHandler extends BaseSuggestionHandler {
	public state: Partial<GarageSuggestionState> = {};


	constructor(private garage: ShipGarage) {
		super(garage);
	}

	suggestShip = (event: Event) => {
		if (this.state.currentSuggestion) return;


		const detail = (event as CustomEvent<ShipInEventDetail>).detail;
		const targetCell = detail.currentTargetCell.element;
		const targetRow = targetCell.parentElement! as HTMLTableRowElement;
		const rowIdx = targetRow.rowIndex;

		const clone = detail.clone;

		this.garage.shipFits(detail.originalShip, "Ship doesnt fit in garage");

		var freeRow = SuggestionHandler.closestFreeRow(
			this.garage,
			rowIdx,
			detail.originalShip
		);

		if (freeRow !== null) {
			// clone the clone to be the suggestion ship
			let suggestionShip = new Ship(
				clone.length,
				Orientation.HORIZONTAL,
				true
			);

			
			this.garage.placeShip(suggestionShip, {headRow: freeRow});

			this.state.currentRow!.element.addEventListener("ship-out", this.removeSuggestion);
			this.state.currentRow!.element.addEventListener("ship-placed", this.placeSuggestion);

			this.state = {
				originalShip: detail.originalShip,
				clone: detail.clone,
				source: detail.source,
				currentSuggestion: {
					ship: suggestionShip,
					row: freeRow,
					col: 0,
				},
			};
		}
	};

	removeSuggestion = () => {
		this.clearSuggestion();
		const rowElement = this.state.currentRow!.element;
		rowElement.removeEventListener("ship-out", this.removeSuggestion);
		rowElement.removeEventListener("ship-placed", this.placeSuggestion);
	};


	rotateSuggestion = () => {}

	equatorCrossHandler = () => {}

	static closestFreeRow(
		garage: ShipGarage,
		row: number,
		disregard?: Ship
	): number | null {
		// check given row first
		if (garage.rowEmpty(row, disregard)) return row;

		for (let offset = 1; offset < garage.shipArray.length; offset++) {
			const upRow = row - offset;
			if (garage.rowEmpty(upRow, disregard)) {
				return upRow;
			}
			const downRow = row + offset;
			if (garage.rowEmpty(downRow, disregard)) {
				return downRow;
			}
		}
		return null;
	}
}
