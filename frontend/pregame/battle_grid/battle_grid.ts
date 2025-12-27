import { Ship, Orientation } from "../ship/ship.js";
import { Grid } from "../grid/grid.js";
import { ShipGrid, ShipPosition } from "../utility/ship_grid.js";

export class BattleGrid extends ShipGrid {
	private cells: (Ship | null)[][];
	public ships: Map<Ship, ShipPosition>;

	constructor(grid: Grid, ships?: Map<Ship, ShipPosition>) {
		super(grid);
		
		this.cells = Array.from({ length: grid.rows }, () =>
			Array(grid.cols).fill(null)
		);
		
		this.ships = new Map<Ship, ShipPosition>();
		
		this.update_html();
		
		if (ships)
			ships.forEach((pos, ship) => {
				this.placeShip(ship, pos.startRow, pos.startCol);
			});

		
	}

	prepareCellHTML(cell: HTMLTableCellElement) {
		cell.addEventListener(
			"ship-over",
			new SuggestionHandler(this, cell).suggestShip
		);
	}

	 render(): HTMLElement {
		 const el = document.createElement("section");
		el.id = "battle-grid";

		for (const row of Array.from(this.grid.html.rows)) {
			for (const cell of Array.from(row.cells)) {
				this.prepareCellHTML(cell);
			}
		}

		el.appendChild(this.grid.html);

		for (const [ship, pos] of this.ships) {
			const ship_el = ship.html;
			this.prepareShipHTML(ship, pos.startRow, pos.startCol);
			el.appendChild(ship_el);
		}
		 return el;
	}


	reset(newShips?: Map<Ship, ShipPosition>) {
		this.ships.forEach((_, ship) => {
			this.removeShip(ship);
		});

		if (newShips) {
			newShips.forEach((pos, ship) => {
				this.placeShip(ship, pos.startRow, pos.startCol);
			});
		}
	}


	canPlaceShip(ship: Ship, startRow: number, startCol: number): boolean {
		// basic bounds
		if (startRow < 0 || startCol < 0) return false;

		if (!this.shipFitsBounds(ship, startRow, startCol)) return false;

		if (!this.shipHasNoOverlap(ship, startRow, startCol)) return false;

		return true;
	}

	shipHasNoOverlap(
		ship: Ship,
		startRow: number = 0,
		startCol: number = 0,
		disregard?: Ship
	): boolean {
		if (ship.getOrientation() === Orientation.HORIZONTAL) {
			for (let c = startCol; c < startCol + ship.length; c++) {
				const cell = this.cells[startRow][c];
				if (cell && cell !== disregard) {
					return false;
				}
			}
		} else {
			for (let r = startRow; r < startRow + ship.length; r++) {
				const cell = this.cells[r][startCol];
				if (cell && cell !== disregard) {
					return false;
				}
			}
		}

		return true;
	}

	shipFitsBounds(
		ship: Ship,
		startRow: number = 0,
		startCol: number = 0
	): boolean {
		if (ship.getOrientation() === Orientation.HORIZONTAL) {
			return startCol + ship.length <= this.grid.cols;
		} else {
			return startRow + ship.length <= this.grid.rows;
		}
	}

	placeShip(ship: Ship, startRow: number, startCol: number) {
		if (!this.canPlaceShip(ship, startRow, startCol))
			throw new RangeError("cannot place ship");

		if (ship.getOrientation() === Orientation.HORIZONTAL) {
			for (let c = startCol; c < startCol + ship.length; c++) {
				this.cells[startRow][c] = ship;
			}
		} else {
			for (let r = startRow; r < startRow + ship.length; r++) {
				this.cells[r][startCol] = ship;
			}
		}

		this.ships.set(ship, { startRow, startCol });

		this.prepareShipHTML(ship, startRow, startCol);

		this.html.appendChild(ship.html);
	}

	containsShip(ship: Ship): boolean {
		return this.ships.has(ship);
	}

	removeShip(ship: Ship) {
		const pos = this.ships.get(ship);
		if (!pos) throw new Error("ship not found on grid");

		if (ship.getOrientation() === Orientation.HORIZONTAL) {
			for (let c = pos.startCol; c < pos.startCol + ship.length; c++) {
				this.cells[pos.startRow][c] = null;
			}
		} else {
			for (let r = pos.startRow; r < pos.startRow + ship.length; r++) {
				this.cells[r][pos.startCol] = null;
			}
		}

		this.ships.delete(ship);
		ship.html.remove();
	}
}

import {
	BaseSuggestionHandler,
	ShipOverEventDetail,
} from "../utility/suggestion_handler.js";

class SuggestionHandler extends BaseSuggestionHandler {
	// private state!: SuggestionState;
	readonly cellRow: number;
	readonly cellCol: number;

	constructor(
		private battleGrid: BattleGrid,
		private cell: HTMLTableCellElement
	) {
		super();
		this.cellRow = (this.cell.parentElement! as HTMLTableRowElement).rowIndex;
		this.cellCol = this.cell.cellIndex;
	}

	clearSuggestion = () => {
		this.state.current_suggestion?.ship.html.remove();
		this.state.current_suggestion = undefined;
	}

	suggestShip = (event: Event) => {
		// prevent multiple suggestions when hovering over the same cell
		if (this.state.current_suggestion) {
			return;
		}

		const detail = (event as CustomEvent<ShipOverEventDetail>).detail;

		// clone the clone to be the suggestion ship
		let shipClone_clone = new Ship(
			detail.shipClone.length,
			detail.shipClone.getOrientation()
		);

		// initial bounds check
		if (!this.battleGrid.shipFitsBounds(shipClone_clone)) return;

		let { headRow: inBoundsHeadRow, headCol: inBoundsHeadCol } =
			SuggestionHandler.closestInBoundsPosition(
				this.battleGrid,
				shipClone_clone,
				this.cellRow,
				this.cellCol
			);

		if (
			this.battleGrid.shipHasNoOverlap(
				shipClone_clone,
				inBoundsHeadRow,
				inBoundsHeadCol,
				detail.originalShip // disregard the original ship to allow moving ships on their old position
			)
		) {
			shipClone_clone.html.classList.add("suggestion");
			shipClone_clone.html.style.setProperty(
				"--row",
				inBoundsHeadRow.toString()
			);
			shipClone_clone.html.style.setProperty(
				"--col",
				inBoundsHeadCol.toString()
			);

			this.battleGrid.html.appendChild(shipClone_clone.html);

			this.state.current_suggestion = {
				ship: shipClone_clone,
				row: inBoundsHeadRow,
				col: inBoundsHeadCol,
			};

			this.cell.addEventListener("ship-out", this.removeSuggestion);
			this.cell.addEventListener(
				"ship-rotate",
				this.rotateSuggestion
			);
			this.cell.addEventListener(
				"ship-placed",
				this.placeSuggestion
			);
		}

		this.state.originalShip = detail.originalShip;
		this.state.shipClone = detail.shipClone;
		this.state.sourceShipGrid = detail.source;
	}

	rotateSuggestion = () => {
		this.clearSuggestion();

		// retry suggestion after rotation
		this.suggestShip(
			new CustomEvent("ship-over", {
				detail: {
					source: this.state.sourceShipGrid!,
					originalShip: this.state.originalShip!,
					shipClone: this.state.shipClone!,
				},
				bubbles: false,
			})
		);
	}

	placeSuggestion = () => {
		// case 1: no suggestion to place
		if (!this.state.current_suggestion) {
			const originalShip = this.state.originalShip!;

			originalShip.html.classList.remove("dragged");
			originalShip.html.style.pointerEvents = "auto";
			return;
		}

		// case 2: place the suggestion

		if (this.state.sourceShipGrid!.containsShip(this.state.originalShip!)) {
			this.state.sourceShipGrid!.removeShip(this.state.originalShip!);
		}

		this.state.originalShip!.html.remove();

		let { ship, row, col } = this.state.current_suggestion!;

		this.removeSuggestion();

		ship.html.classList.remove("suggestion");

		this.battleGrid.placeShip(ship, row, col);
	}

	removeSuggestion = () => {
		this.clearSuggestion();

		this.cell.removeEventListener("ship-out", this.removeSuggestion);
		this.cell.removeEventListener(
			"ship-rotate",
			this.rotateSuggestion
		);
		this.cell.removeEventListener(
			"ship-placed",
			this.placeSuggestion
		);
	}

	static closestInBoundsPosition(
		battleGrid: BattleGrid,
		ship: Ship,
		centerRow: number,
		centerCol: number
	): { headRow: number; headCol: number } {
		if (ship.getOrientation() === Orientation.HORIZONTAL) {
			let lengthOffset = Math.floor(ship.length / 2); // offset from center to head
			let headRow = centerRow;
			let headCol = Math.max(
				0,
				Math.min(centerCol - lengthOffset, battleGrid.grid.cols - ship.length)
			);
			return { headRow, headCol };
		} else {
			let lengthOffset = Math.floor(ship.length / 2); // offset from center to head
			let headRow = Math.max(
				0,
				Math.min(centerRow - lengthOffset, battleGrid.grid.rows - ship.length)
			);
			let headCol = centerCol;
			return { headRow, headCol };
		}
	}
}
