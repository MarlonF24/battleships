import { Ship, Orientation } from "../ship/ship.js";
import { Grid } from "../grid/grid.js";
import { ShipGrid } from "../utility/ship_grid.js";
import { ShipPosition } from "../ship/ship.js";

import "./battle_grid.css"; 

export class BattleGrid extends ShipGrid {
	public readonly shipInHandler: EventListener = new SuggestionHandler(this).suggestShip;
	
	private cells: (Ship | null)[][];

	constructor(grid: Grid, ships?: Map<Ship, ShipPosition>) {
		super(grid);
		
		this.cells = Array.from({ length: grid.rows }, () =>
			Array(grid.cols).fill(null)
		);
			
		
		if (ships)
			ships.forEach((pos, ship) => {
				this.placeShip(ship, pos);
			});
	}


	reset(newShips?: Map<Ship, ShipPosition>) {
		this.ships.forEach((_, ship) => {
			this.removeShip(ship);
		});

		if (newShips) {
			newShips.forEach((pos, ship) => {
				this.placeShip(ship, pos);
			});
		}
	}


	canPlaceShip(ship: Ship, {headRow, headCol}: ShipPosition): boolean {
		// basic bounds
		if (headRow < 0 || headCol < 0) return false;

		if (!this.shipFitsBounds(ship, headRow, headCol)) return false;

		if (!this.shipHasNoOverlap(ship, headRow, headCol)) return false;

		return true;
	}

	shipHasNoOverlap(
		ship: Ship,
		headRow: number = 0,
		headCol: number = 0,
		disregard?: Ship
	): boolean {
		if (ship.orientation === Orientation.HORIZONTAL) {
			for (let c = headCol; c < headCol + ship.length; c++) {
				const cell = this.cells[headRow][c];
				if (cell && cell !== disregard) {
					return false;
				}
			}
		} else {
			for (let r = headRow; r < headRow + ship.length; r++) {
				const cell = this.cells[r][headCol];
				if (cell && cell !== disregard) {
					return false;
				}
			}
		}

		return true;
	}

	shipFitsBounds(
		ship: Ship,
		headRow: number = 0,
		headCol: number = 0
	): boolean {
		if (ship.orientation === Orientation.HORIZONTAL) {
			return headCol + ship.length <= this.grid.cols;
		} else {
			return headRow + ship.length <= this.grid.rows;
		}
	}


    placeShip(ship: Ship, {headRow, headCol}: ShipPosition): void{
        if (!this.canPlaceShip(ship, {headRow, headCol}))
            throw new RangeError("cannot place ship");
		

		if (!ship.isSuggestion) {

			if (ship.orientation === Orientation.HORIZONTAL) {
				for (let c = headCol; c < headCol + ship.length; c++) {
					this.cells[headRow][c] = ship;
				}
			} else {
				for (let r = headRow; r < headRow + ship.length; r++) {
					this.cells[r][headCol] = ship;
				}
			}
		}

        this.ships.set(ship, {headRow, headCol});
    }

	containsShip(ship: Ship): boolean {
		return this.ships.has(ship);
	}

	removeShip(ship: Ship) {
		const pos = this.ships.get(ship);
		if (!pos) throw new Error("ship not found on grid");

		if (!ship.isSuggestion)	{
			if (ship.orientation === Orientation.HORIZONTAL) {
				for (let c = pos.headCol; c < pos.headCol + ship.length; c++) {
					this.cells[pos.headRow][c] = null;
				}
			} else {
				for (let r = pos.headRow; r < pos.headRow + ship.length; r++) {
					this.cells[r][pos.headCol] = null;
				}
			}
		}

		this.ships.delete(ship);
	}
}

import {
	BaseSuggestionHandler,
	BaseSuggestionState,
	EquatorCrossEvent,
	ShipInEvent,
} from "../utility/suggestion_handler.js";


interface BattleGridSuggestionState extends BaseSuggestionState {
	currentCell: {
		readonly element: HTMLTableCellElement;
		readonly gridCoord: { row: number; col: number };
		readonly inCellPosition: { x: number; y: number };
	}

}


class SuggestionHandler extends BaseSuggestionHandler {
	protected state : Partial<BattleGridSuggestionState> = {};
	
	constructor(private battleGrid: BattleGrid) {super(battleGrid)}


	suggestShip = (event: Event) => {
		
		// prevent multiple suggestions when hovering over the same cell
		if (this.state.currentSuggestion) {
			return;
		}
		
		const targetCell = event.target as HTMLTableCellElement;
		
		const detail = (event as ShipInEvent).detail;
		
		
		this.state.currentCell = {
			element: targetCell,
			gridCoord: { row: (targetCell.parentElement! as HTMLTableRowElement).rowIndex, col: targetCell.cellIndex },
			inCellPosition: detail.currentTargetCell.inCellPosition
		}; 
		

		// clone the clone to be the suggestion ship
		let suggestionShip = new Ship(
			detail.originalShip.length,
			detail.originalShip.orientation,
			true // isSuggestion
		);

		// initial bounds check
		if (!this.battleGrid.shipFitsBounds(suggestionShip)) return;

		let { headRow: inBoundsHeadRow, headCol: inBoundsHeadCol } =
			SuggestionHandler.closestInBoundsPosition(
				this.battleGrid,
				suggestionShip,
				this.state.currentCell.gridCoord,
				this.state.currentCell.inCellPosition
			);

		if (
			this.battleGrid.shipHasNoOverlap(
				suggestionShip,
				inBoundsHeadRow,
				inBoundsHeadCol,
				detail.originalShip // disregard the original ship to allow moving ships on their old position
			)
		) {
			this.battleGrid.placeShip(
				suggestionShip,
				{ headRow: inBoundsHeadRow, headCol: inBoundsHeadCol }
			);

			this.state.currentSuggestion = {
				ship: suggestionShip,
				row: inBoundsHeadRow,
				col: inBoundsHeadCol,
			};

			this.state.currentCell.element.addEventListener("ship-out", this.removeSuggestion);
			this.state.currentCell.element.addEventListener("ship-rotate",this.rotateSuggestion);
			this.state.currentCell.element.addEventListener("ship-placed", this.placeSuggestion);
			this.state.currentCell.element.addEventListener("equator-cross", this.equatorCrossHandler);
		}

		this.state.originalShip = detail.originalShip;
		this.state.clone = detail.clone;
		this.state.source = detail.source;
	}


	equatorCrossHandler = (event: Event) => {
		this.clearSuggestion();

		
		this.suggestShip(
			new ShipInEvent(
				{
					source: this.state.source!,
					originalShip: this.state.originalShip!,
					clone: this.state.clone!,
					currentTargetCell: {
						element: this.state.currentCell!.element,
						inCellPosition: (event as EquatorCrossEvent).detail.inCellPosition,
					}
				}
			)
		);
	}


	rotateSuggestion = () => {
		this.clearSuggestion();

		// retry suggestion after rotation
		this.suggestShip(
			new ShipInEvent({
				source: this.state.source!,
				originalShip: this.state.originalShip!,
				clone: this.state.clone!,
				currentTargetCell: {
					element: this.state.currentCell!.element,
					inCellPosition: this.state.currentCell!.inCellPosition
				}
			}
			)
		);
	}

	

	removeSuggestion = () => {
		this.clearSuggestion();

		this.state.currentCell!.element.removeEventListener("ship-out", this.removeSuggestion);
		this.state.currentCell!.element.removeEventListener("ship-rotate", this.rotateSuggestion);
		this.state.currentCell!.element.removeEventListener("ship-placed", this.placeSuggestion);
	}

	static closestInBoundsPosition(
		battleGrid: BattleGrid,
		ship: Ship,
		centerPosition: { row: number; col: number },
		inCellPosition?: { x: number; y: number }
	): { headRow: number; headCol: number } {
		if (ship.orientation === Orientation.HORIZONTAL) {
			let lengthOffset = Math.floor(ship.length / 2); // offset from center to head
			let headRow = centerPosition.row;
			let headCol = Math.max(
				0,
				Math.min(centerPosition.col - lengthOffset, battleGrid.grid.cols - ship.length)
			);

			if (ship.length % 2 === 0 && inCellPosition) {
				// adjust for even-length ships based on in-cell position
				if (inCellPosition.x >= 0.5 && headCol + ship.length < battleGrid.grid.cols) {
					headCol += 1;
				}
			}
			return { headRow, headCol };

		} else {
			let lengthOffset = Math.floor(ship.length / 2); // offset from center to head
			let headRow = Math.max(
				0,
				Math.min(centerPosition.row - lengthOffset, battleGrid.grid.rows - ship.length)
			);
			let headCol = centerPosition.col;

			if (ship.length % 2 === 0 && inCellPosition) {
				// adjust for even-length ships based on in-cell position
				if (inCellPosition.y >= 0.5 && headRow + ship.length < battleGrid.grid.rows) {
					headRow += 1;
				}
			}
			return { headRow, headCol };
		}
	}
}
