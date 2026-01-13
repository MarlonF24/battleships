import { observable, override, makeObservable } from "mobx";

import { Ship, ShipLike, Orientation, ShipGrid } from "../../../base";
import { ShipSuggestion } from "../DragDrop/dynamic_ship.js";
import { PregameShipGrid } from "../PregameShipGrid.js";

import "./garage.css";

export class ShipGarage extends PregameShipGrid {
	public readonly shipInHandler: EventListener = new GarageSuggestionHandler(this).suggestShip;
	public readonly styleClassName = "ship-garage";
	

	constructor(ships: Ship[], sort: boolean = true) {
		
		if (sort) ships.sort((a, b) => b.length - a.length);
		
		const initialShips = new Map(ships.map((ship, index) => [ship, { headRow: index, headCol: 0 }]));
		
		super(
				{rows: ships.length,
				cols: Math.max(...ships.map((s) => (typeof s === 'number' ? s : s.length)), 1)}
				, initialShips
		);

		makeObservable(this, {
			reset: override,
		});


		sessionStorage.setItem(
			"initial-garage",
			JSON.stringify((ships as Ship[]).map((s) => s.length))
		);

		this.shipGrid.placeShip = this.horizontalCheckDecorator(this.shipGrid.placeShip);
	}

	reset() { // !! only call this when removing all ships !!
		this.shipGrid.clear();
		
		const initialShips = JSON.parse(sessionStorage.getItem("initial-garage")!);

		initialShips.forEach((length: number, index: number) => {
			this.shipGrid.placeShip(new Ship(length, Orientation.HORIZONTAL), {headRow: index, headCol: 0});
		});
	}


	rowInBounds(row: number, err_msg?: string): boolean {
		if (row >= this.size.rows || row < 0) {
			if (err_msg) throw new RangeError(err_msg);
			else return false;
		}
		return true;
	}

	shipFits(ship: ShipLike, err_msg?: string): boolean {
		if (ship.length > this.size.cols) {
			if (err_msg) throw new RangeError(err_msg);
			else return false;
		}
		return true;
	}

	rowEmpty(row: number, disregard?: Ship): boolean {
		if (!this.rowInBounds(row)) return false;
		return this.shipCells[row][0] == null || this.shipCells[row][0] === disregard;
	}


	horizontalCheckDecorator(func: (this: ShipGrid, ship: Ship, position: {headRow: number, headCol: number}) => void) {
		
		function wrapper( this: ShipGrid, ship: Ship, {headRow, headCol = 0}: {headRow: number, headCol?: number} ): void {
			if (ship.orientation != Orientation.HORIZONTAL) throw new Error("Cannot place non-horizontal ship in garage"); 
	
			func.call(this, ship, {headRow, headCol});
		}
	
		return wrapper;
	}
}

import {
	BaseSuggestionHandler,
	BaseSuggestionState,
	ShipInEventDetail,
} from "../DragDrop/suggestion_handler.js";


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
		this.state.targetShipGridHTML ??= (event.currentTarget as HTMLElement).querySelector(".ship-grid")!;
		const rowIdx = targetRow.rowIndex;


		this.garage.shipFits(detail.originalShip, "Ship too large for garage");

		var freeRow = GarageSuggestionHandler.closestFreeRow(
			this.garage,
			rowIdx,
			detail.originalShip
		);

		if (freeRow !== null) {
			// clone the clone to be the suggestion ship
			let suggestionShip = new ShipSuggestion(detail.clone);

			
			suggestionShip.suggest(this.state.targetShipGridHTML, { headRow: freeRow, headCol: 0 }, Orientation.HORIZONTAL);

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

		for (let offset = 1; offset < garage.shipGrid.size.rows; offset++) {
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
