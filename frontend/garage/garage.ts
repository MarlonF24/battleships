import { Ship, Orientation } from "../ship/ship.js";
import { Grid } from "../grid/grid.js";
import { Component } from "../component.js";

export class ShipGarage extends Component {
	public ships: (Ship | null)[];
	public readonly grid: Grid;
	readonly maxLen: number;
	html!: HTMLElement;

	constructor(ships: Ship[]) {
		super();
		this.grid = new Grid(
			ships.length,
			Math.max(...ships.map((s) => (s ? s.length : 0)), 1)
		);
		this.ships = ships;
		this.ships.forEach((element) => {
			if (element) element.setOrientation(Orientation.HORIZONTAL);
		});
		this.maxLen = this.grid.cols;
		this.update_html();
	}

	render(): HTMLElement {
		const el = document.createElement("div");
		el.id = "ship-garage";

		el.appendChild(this.grid.html);

		this.ships.forEach((ship, rowIdx) => {
			if (ship) {
				const ship_el = ship.html;
				ship_el.style.setProperty("--row", rowIdx.toString());
				ship_el.style.setProperty("--col", (0).toString());

				ship_el.dataset.source = "garage";

				el.appendChild(ship_el);
			}
		});
		return el;
	}

	validateRow(row: number, err_msg?: string): boolean {
		if (row >= this.ships.length || row < 0) {
			if (err_msg) throw new RangeError(err_msg);
			else return false;
		}
		return true;
	}

	validateShip(ship: Ship, err_msg?: string): boolean {
		if (ship.length > this.maxLen) {
			if (err_msg) throw new RangeError(err_msg);
			else return false;
		}
		return true;
	}

	canPlaceShip(row: number, ship: Ship): boolean {
		if (!this.validateRow(row)) return false;
		if (!this.validateShip(ship)) return false;
		return this.ships[row] == null;
	}

	takeShip(row: number) {
		this.validateRow(
			row,
			`Tried to take ship out of bounds of garage (row ${row})`
		);
		this.validateShip(
			this.ships[row]!,
			`No ship at this ${row} to take from garage`
		);
		let ship = this.ships[row];
		this.ships[row] = null;
		return ship;
	}

	placeShip(row: number, ship: Ship) {
		if (!this.canPlaceShip(row, ship))
			throw new Error(`Cannot place ship at ${row} in garage`);
		this.ships[row] = ship;
	}
}
