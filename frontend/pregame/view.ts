import { BattleGrid } from "./battle_grid/battle_grid.js";
import { Grid } from "./grid/grid.js";
import { ShipGarage } from "./garage/garage.js";
import { Ship } from "./ship/ship.js";
import { ResetButton } from "./buttons/reset.js";

export function pregameView(
	container: HTMLElement,
	
) {
	// example initialization
	const gameGrid = new BattleGrid(new Grid(10, 10));

	const garage = new ShipGarage([
		new Ship(5),
		new Ship(4),
		new Ship(3),
		new Ship(3),
		new Ship(2),
	]);

	if (gameGrid.grid.cols < garage.maxLen && gameGrid.grid.cols < garage.maxLen) {
		throw new Error("Some garage ships do not fit in the game grid");
	}

	if (
		garage.shipArray.length > gameGrid.grid.rows &&
		garage.shipArray.length > gameGrid.grid.cols
	) {
		throw new Error("Too many ships for the game grid");
	}

	container.innerHTML = "";
	container.appendChild(gameGrid.html);
	container.appendChild(garage.html);
	const resetButton = new ResetButton(gameGrid, garage);
	container.appendChild(resetButton.html);
}




