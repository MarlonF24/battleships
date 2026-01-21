/**
 *  (c) redxam llc and affiliates. Confidential and proprietary.
 *
 *  @oncall dev+Author
 *  @format
 */

"use strict";

import { Ship, ShipPosition } from "../../../base";
import { ShipDragClone, ShipSuggestion } from "./DynamicShip.js";
import { PregameShipGrid } from "../PregameShipGrid.js";


export interface EquatorCrossEventDetail {
	inCellPosition: { x: number; y: number };
}

export class EquatorCrossEvent extends CustomEvent<EquatorCrossEventDetail> {
	constructor(detail: EquatorCrossEventDetail, bubbles = true) {
		super("equator-cross", { detail, bubbles });
	}
}


export interface ShipInEventDetail {
	originalShip: Ship
	clone: ShipDragClone;
	source: PregameShipGrid;
	currentTargetCell: {
		readonly element: HTMLTableCellElement;
		readonly inCellPosition: { x: number; y: number };
	}
}


export class ShipInEvent extends CustomEvent<ShipInEventDetail> {
	constructor(detail: ShipInEventDetail, bubbles = true) {
		super("ship-in", { detail, bubbles });
	}
}

export class ShipOutEvent extends Event {
	constructor(bubbles = true) {
		super("ship-out", { bubbles });
	}
}

export class ShipPlacedEvent extends Event {
	constructor(bubbles = true) {
		super("ship-placed", { bubbles });
	}
}

export class ShipRotatedEvent extends Event {
	constructor(bubbles = true) {
		super("ship-rotate", { bubbles });
	}
}

export interface BaseSuggestionState {
	source: PregameShipGrid;
	clone: ShipDragClone;
	originalShip: Ship;
	currentSuggestion: {
		ship: ShipSuggestion;
		position: ShipPosition;
	};
}

export abstract class BaseSuggestionHandler {
	protected state: Partial<BaseSuggestionState> = {};
	protected targetShipGridHTML!: HTMLElement; // !!!must be assigned on first suggestion

	constructor(readonly targetShipGrid: PregameShipGrid) {}

	clearSuggestion = () => {
		this.state.currentSuggestion?.ship.remove();
		this.state.currentSuggestion = undefined;
	};

	abstract suggestShip: (event: Event) => void;

	abstract removeSuggestion: () => void;

	placeSuggestion = () => {
		// case 1: no suggestion to place
		if (!this.state.currentSuggestion) return;
		
		// case 2: place the suggestion
		this.state.source!.shipGrid.removeShip(this.state.originalShip!);
		this.state.currentSuggestion.ship.remove();
		this.targetShipGrid.shipGrid.placeShip(
			this.state.currentSuggestion.ship.instantiate(),
			this.state.currentSuggestion.position
		);
		this.state.currentSuggestion = undefined;
	}

	abstract rotateSuggestion: () => void;
	
	abstract equatorCrossHandler: (event: Event) => void;
}
