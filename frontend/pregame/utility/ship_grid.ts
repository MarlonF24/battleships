import { Grid } from "../grid/grid.js";
import { Ship } from "../ship/ship.js";
import { Component } from "./component.js";
import { Dragger } from "./drag.js";

export interface ShipPosition {
	startRow: number;
	startCol: number;
}

export abstract class ShipGrid extends Component {
	readonly grid: Grid;
	public abstract ships: Map<Ship, ShipPosition> | Map<Ship, number>;

	constructor(grid: Grid) {
		super();
		this.grid = grid;
	}

	abstract removeShip(ship: Ship): void;

	abstract containsShip(ship: Ship): boolean;

	prepareShipHTML(ship: Ship, row: number, col: number) {
		ship.html.style.setProperty("--row", row.toString());
		ship.html.style.setProperty("--col", col.toString());
		ship.html.addEventListener(
			"mousedown",
			new Dragger(ship, this).mouseDownHandler.bind(this)
		);
	}
}
