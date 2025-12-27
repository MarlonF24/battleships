import { BattleGrid } from "./battle_grid/battle_grid.js";
import { Grid } from "./grid/grid.js";
import { ShipGarage } from "./garage/garage.js";
import { Ship } from "./ship/ship.js";
import { ResetButton, ReadyButton, RandomButton } from "./buttons/buttons.js";


export function pregameView(
	mainFlex: HTMLElement,
	buttonsFlex: HTMLElement
) {
	mainFlex.innerHTML = "";
	buttonsFlex.innerHTML = "";
	
	const gameGrid = new BattleGrid(new Grid(10, 10));
	mainFlex.appendChild(gameGrid.html);
	
	const garage = new ShipGarage([
		new Ship(9),
		new Ship(6),
		new Ship(5),
		new Ship(4),
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

	mainFlex.appendChild(garage.html);
	
	
	const resetButton = new ResetButton(gameGrid, garage);
	buttonsFlex.appendChild(resetButton.html);
	
	const readyButton = new ReadyButton(garage);
	buttonsFlex.appendChild(readyButton.html);

	const randomButton = new RandomButton(gameGrid, garage);
	buttonsFlex.appendChild(randomButton.html);
}




