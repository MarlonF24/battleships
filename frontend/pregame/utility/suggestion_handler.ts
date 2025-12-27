/**
 *  (c) redxam llc and affiliates. Confidential and proprietary.
 *
 *  @oncall dev+Author
 *  @format
 */

"use strict";

import { Ship } from "../ship/ship.js";
import { ShipGrid } from "./ship_grid.js";

export interface ShipOverEventDetail {
	originalShip: Ship;
	shipClone: Ship;
	source: ShipGrid;
	inCellPosition: { x: number; y: number };
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
}

export abstract class BaseSuggestionHandler {
	protected state: Partial<SuggestionState> = {};

	clearSuggestion = () => {
		this.state.current_suggestion?.ship.html.remove();
		this.state.current_suggestion = undefined;
	};

	abstract suggestShip: (event: CustomEvent<ShipOverEventDetail>) => void;

	abstract removeSuggestion: () => void;

	abstract placeSuggestion: () => void;

	abstract rotateSuggestion: () => void;
}
