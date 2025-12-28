/**
 *  (c) redxam llc and affiliates. Confidential and proprietary.
 *
 *  @oncall dev+Author
 *  @format
 */

"use strict";

import { Ship } from "../ship/ship.js";
import { ShipGrid } from "./ship_grid.js";





export interface EquatorCrossEventDetail {
	inCellPosition: { x: number; y: number };
}

export class EquatorCrossEvent extends CustomEvent<EquatorCrossEventDetail> {
	constructor(detail: EquatorCrossEventDetail, bubbles = true) {
		super("equator-cross", { detail, bubbles });
	}
}


export interface ShipInEventDetail extends EquatorCrossEventDetail {
	originalShip: Ship;
	shipClone: Ship;
	source: ShipGrid;
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

export interface SuggestionState {
	sourceShipGrid: ShipGrid;
	originalShip: Ship;
	shipClone: Ship;
	current_suggestion: {
		ship: Ship;
		row: number;
		col: number;
	};
	inCellPosition: { x: number; y: number };
}

export abstract class BaseSuggestionHandler {
	protected state: Partial<SuggestionState> = {};

	clearSuggestion = () => {
		this.state.current_suggestion?.ship.html.remove();
		this.state.current_suggestion = undefined;
	};

	abstract suggestShip: (event: Event) => void;

	abstract removeSuggestion: () => void;

	abstract placeSuggestion: () => void;

	abstract rotateSuggestion: () => void;
	
	abstract equatorCrossHandler: (event: Event) => void;
}
