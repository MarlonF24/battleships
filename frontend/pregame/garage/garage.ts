import { Ship, Orientation } from "../ship/ship.js";
import { Grid } from "../grid/grid.js";
import { ShipGrid } from "../utility/ship_grid.js";

export class ShipGarage extends ShipGrid {
	public ships: Map<Ship, number>;
	readonly shipArray: (Ship | null)[];
	readonly maxLen: number;
	html!: HTMLDivElement;

	constructor(ships: Ship[]) {
		super(
			new Grid(
				ships.length,
				Math.max(...ships.map((s) => (s ? s.length : 0)), 1)
			)
		);

		this.ships = new Map();
		this.shipArray = [];

		for (let index = 0; index < ships.length; index++) {
			this.shipArray[index] = ships[index];
			this.ships.set(ships[index], index);
		}

		this.maxLen = this.grid.cols;
		this.update_html();

		sessionStorage.setItem("initial-garage", JSON.stringify(
			ships.map((s) => s.length)
		));
	}

	reset() {
		this.ships.forEach((_, ship) => {
			this.removeShip(ship);
		});

		const initialShips = JSON.parse(sessionStorage.getItem("initial-garage")!);
		
		initialShips.forEach((length: number, index: number) => {
			this.placeShip(index, new Ship(length, Orientation.HORIZONTAL));
		});
	}

	prepareRowHTML(row: HTMLTableRowElement) {
		row.addEventListener(
			"ship-over",
			new SuggestionHandler(this, row).suggestShip
		);
	}

	render(): HTMLDivElement {
		const el = document.createElement("div");
		el.id = "ship-garage";

		for (const row of this.grid.html.rows) {
			this.prepareRowHTML(row);
		}

		el.appendChild(this.grid.html);

		this.ships.forEach((rowIdx, ship) => {
			if (ship) {
				const ship_el = ship.html;

				this.prepareShipHTML(ship, rowIdx, 0);

				el.appendChild(ship_el);
			}
		});
		return el;
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

		let row = this.ships.get(ship)!;

		ship!.html.remove();

		this.shipArray[row] = null;
		this.ships.delete(ship!);
	}

	placeShip(row: number, ship: Ship) {
		if (!this.canPlaceShip(row, ship))
			throw new Error(`Cannot place ship at ${row} in garage`);

		ship.setOrientation(Orientation.HORIZONTAL);

		this.shipArray[row] = ship;
		this.ships.set(ship, row);

		this.prepareShipHTML(ship, row, 0);

		this.html.appendChild(ship.html);
	}
}

import {
	BaseSuggestionHandler,
	SuggestionState,
	ShipOverEventDetail,
} from "../utility/suggestion_handler.js";

class SuggestionHandler extends BaseSuggestionHandler {
	readonly rowIdx: number;

	constructor(private garage: ShipGarage, readonly row: HTMLTableRowElement) {
		super();
		this.rowIdx = this.row.rowIndex;
		this.suggestShip = this.suggestShip.bind(this);
		
	}

	suggestShip(event: Event) {
		if (this.state.current_suggestion) return;

		const detail = (event as CustomEvent<ShipOverEventDetail>).detail;
		const shipClone = detail.shipClone;

		this.garage.shipFits(shipClone, "Ship doesnt fit in garage");

		var freeRow = SuggestionHandler.closestFreeRow(this.garage, this.rowIdx, detail.originalShip);
		
		
		if (freeRow !== null) {
			// clone the clone to be the suggestion ship
			let shipClone_clone = new Ship(
				shipClone.length,
				shipClone.getOrientation()
			);

			shipClone_clone.setOrientation(Orientation.HORIZONTAL);
			shipClone_clone.html.classList.add("suggestion");
			shipClone_clone.html.style.setProperty("--row", freeRow.toString());
			shipClone_clone.html.style.setProperty("--col", (0).toString());

			this.garage.html.appendChild(shipClone_clone.html);

			this.row.addEventListener("ship-out", this.removeSuggestion.bind(this));
			this.row.addEventListener("ship-placed", this.placeSuggestion.bind(this));

			this.state = {
				originalShip: detail.originalShip,
				shipClone: shipClone,
				sourceShipGrid: detail.source,
				current_suggestion: {
					ship: shipClone_clone,
					row: freeRow,
					col: 0,
				},
			};
		}
	}

	removeSuggestion() {
		this.clearSuggestion();
		this.row.removeEventListener("ship-out", this.removeSuggestion.bind(this));
		this.row.removeEventListener(
			"ship-placed",
			this.placeSuggestion.bind(this)
		);
	}

	placeSuggestion() {
		if (!this.state.current_suggestion) {
			const originalShip = this.state.originalShip!;

			originalShip.html.classList.remove("dragged");
			originalShip.html.style.pointerEvents = "auto";
			return;
		}

		if (this.state.sourceShipGrid!.containsShip(this.state.originalShip!)) {
			this.state.sourceShipGrid!.removeShip(this.state.originalShip!);
		}

		const suggestion = this.state.current_suggestion;

		this.removeSuggestion();
		suggestion.ship.html.classList.remove("suggestion");
		this.garage.placeShip(suggestion.row, suggestion.ship);
	}

	rotateSuggestion(): void {
		// no rotation in garage
	}

	static closestFreeRow(garage: ShipGarage, row: number, disregard?: Ship): number | null {
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
