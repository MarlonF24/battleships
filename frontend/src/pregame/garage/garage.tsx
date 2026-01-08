import { observable, action, override, makeObservable } from "mobx";

import { Ship, Grid, Orientation } from "../../base";
import { ShipLike, ShipSuggestion } from "../drag_drop/dynamic_ship.js";
import { PregameShipGrid } from "../utility/ship_grid.js";

import "./garage.css";

export class ShipGarage extends PregameShipGrid {
	public readonly shipInHandler: EventListener = new GarageSuggestionHandler(this).suggestShip;
	
	readonly shipArray: (Ship | null)[];
	readonly maxLen: number;

	constructor(ships: Ship[], sort: boolean = true) {
		super(
			new Grid(
				ships.length,
				Math.max(...ships.map((s) => (typeof s === 'number' ? s : s.length)), 1)
			)
		);

		makeObservable(this, {
			shipArray: observable.shallow,
			reset: override,
			removeShip: override,
			placeShip: override,
		});

		if (sort) ships.sort((a, b) => b.length - a.length);

		this.shipGrid.ships = new Map(ships.map((ship, index) => [ship, { headRow: index, headCol: 0 }]));
		
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
		
		const initialShips = JSON.parse(sessionStorage.getItem("initial-garage")!);

		initialShips.forEach((length: number, index: number) => {
			this.placeShip(new Ship(length, Orientation.HORIZONTAL), {headRow: index});
		});
	}


	rowInBounds(row: number, err_msg?: string): boolean {
		if (row >= this.shipArray.length || row < 0) {
			if (err_msg) throw new RangeError(err_msg);
			else return false;
		}
		return true;
	}

	shipFits(ship: ShipLike, err_msg?: string): boolean {
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

	canPlaceShip(row: number, ship: ShipLike): boolean {
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
} from "../drag_drop/suggestion_handler.js";


interface GarageSuggestionState extends BaseSuggestionState {
	currentRow: {
		readonly rowIdx: number;
		readonly element: HTMLTableRowElement;
	};
}

class GarageSuggestionHandler extends BaseSuggestionHandler {
	public state: Partial<GarageSuggestionState> = {};


	constructor(private garage: ShipGarage) {
		super(garage);
	}

	suggestShip = (event: Event) => {
		if (this.state.currentSuggestion) return;


		const detail = (event as CustomEvent<ShipInEventDetail>).detail;
		const targetCell = detail.currentTargetCell.element;
		const targetRow = targetCell.parentElement! as HTMLTableRowElement;
		this.state.targetShipGridHTML ??= event.currentTarget as HTMLElement;
		const rowIdx = targetRow.rowIndex;


		this.garage.shipFits(detail.originalShip, "Ship doesnt fit in garage");

		var freeRow = GarageSuggestionHandler.closestFreeRow(
			this.garage,
			rowIdx,
			detail.originalShip
		);

		if (freeRow !== null) {
			// clone the clone to be the suggestion ship
			let suggestionShip = new ShipSuggestion(detail.clone);

			
			suggestionShip.suggest(this.state.targetShipGridHTML!, { headRow: freeRow, headCol: 0 }, Orientation.HORIZONTAL);

			this.state = {
				originalShip: detail.originalShip,
				clone: detail.clone,
				source: detail.source,
				currentSuggestion: {
					ship: suggestionShip,
					positon: { headRow: freeRow, headCol: 0}
				},
				currentRow: {
					rowIdx: freeRow,
					element: targetRow
				}
			};

			this.state.currentRow!.element.addEventListener("ship-out", this.removeSuggestion);
			this.state.currentRow!.element.addEventListener("ship-placed", this.placeSuggestion);
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
