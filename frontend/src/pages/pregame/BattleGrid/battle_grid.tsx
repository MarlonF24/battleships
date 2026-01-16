import { override, makeObservable } from "mobx";

import { Ship, ShipPosition, ShipLike, socketModels } from "../../../base";
import { PregameShipGrid } from "../PregameShipGrid.js";
import { ShipSuggestion } from "../DragDrop/dynamic_ship.js";

import {
	BaseSuggestionHandler,
	BaseSuggestionState,
	EquatorCrossEvent,
	ShipInEvent,
} from "../DragDrop/suggestion_handler.js";

import "./battle_grid.css"; 

export class BattleGrid extends PregameShipGrid {
	public readonly shipInHandler: EventListener = new BattleGridSuggestionHandler(this).suggestShip;
	public readonly styleClassName: string = "battle-grid";

	constructor(size: {rows: number, cols: number}, ships?: Map<Ship, ShipPosition>) {
		super(size, ships);
		
		makeObservable<BattleGrid>(this, {
			reset: override,
		});
			
	}

	reset(newShips?: Map<Ship, ShipPosition>) {
		this.shipGrid.clear();

		if (newShips) {
			newShips.forEach((pos, ship) => {
				this.shipGrid.placeShip(ship, pos);
			});
		}
	}

}




interface BattleGridSuggestionState extends BaseSuggestionState {
	currentCell: {
		readonly element: HTMLTableCellElement;
		readonly gridCoord: { row: number; col: number };
		readonly inCellPosition: { x: number; y: number };
	}

}


export class BattleGridSuggestionHandler extends BaseSuggestionHandler {
	protected state : Partial<BattleGridSuggestionState> = {};
	
	
	constructor(private battleGrid: BattleGrid) {super(battleGrid)}


	suggestShip = (event: Event) => {
		
		if (!(event instanceof ShipInEvent)) throw new Error("Invalid event type for suggestShip");


		// prevent multiple suggestions when hovering over the same cell
		if (this.state.currentSuggestion) {
			return;
		}
		
		const detail = event.detail;
		const targetCell = detail.currentTargetCell.element;
		this.targetShipGridHTML ??= event.currentTarget as HTMLElement;
		
		
		this.state.currentCell = {
			element: targetCell,
			gridCoord: { row: (targetCell.parentElement! as HTMLTableRowElement).rowIndex, col: targetCell.cellIndex },
			inCellPosition: detail.currentTargetCell.inCellPosition
		}; 
		

		// clone the clone to be the suggestion ship
		let suggestionShip = new ShipSuggestion(detail.clone);

		// initial bounds check
		if (!this.battleGrid.shipGrid.shipFitsBounds(suggestionShip)) return;


		let headPosition =
			BattleGridSuggestionHandler.closestInBoundsPosition(
				this.battleGrid,
				suggestionShip,
				this.state.currentCell.gridCoord,
				this.state.currentCell.inCellPosition
			);

		if (
			this.battleGrid.shipGrid.shipHasNoOverlap(
				suggestionShip,
				headPosition,
				detail.originalShip // disregard the original ship to allow moving ships on their old position
			)
		) {
			suggestionShip.suggest(this.targetShipGridHTML!, headPosition);
			this.state.currentSuggestion = {
				ship: suggestionShip,
				positon: headPosition,
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
		ship: ShipLike,
		centerPosition: { row: number; col: number },
		inCellPosition?: { x: number; y: number }
	): { headRow: number; headCol: number } {
		if (ship.orientation === socketModels.Orientation.HORIZONTAL) {
			let lengthOffset = Math.floor(ship.length / 2); // offset from center to head
			let headRow = centerPosition.row;
			let cloneHeadCol = centerPosition.col - lengthOffset;
			let headCol = Math.max(
				0,
				Math.min(cloneHeadCol, battleGrid.size.cols - ship.length)
			);

			if (ship.length % 2 === 0 && inCellPosition) {
				// adjust for even-length ships based on in-cell position
				if (inCellPosition.x >= 0.5 
					&& cloneHeadCol >= 0
					&& headCol + ship.length < battleGrid.size.cols) {
					headCol += 1;
				}
			}
			return { headRow, headCol };

		} else {
			let lengthOffset = Math.floor(ship.length / 2); // offset from center to head
			let cloneHeadRow = centerPosition.row - lengthOffset;
			let headRow = Math.max(
				0,
				Math.min(cloneHeadRow, battleGrid.size.rows - ship.length)
			);
			let headCol = centerPosition.col;

			if (ship.length % 2 === 0 && inCellPosition) {
				// adjust for even-length ships based on in-cell position
				if (inCellPosition.y >= 0.5 
					&& cloneHeadRow >= 0
					&& headRow + ship.length < battleGrid.size.rows) {
					headRow += 1;
				}
			}
			return { headRow, headCol };
		}
	}
}
