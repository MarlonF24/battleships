import { BattleGrid } from "./battle_grid/battle_grid.js";
import { Grid } from "./grid/grid.js";
import { ShipGarage } from "./garage/garage.js";
import { Ship } from "./ship/ship.js";
import { ResetButton, ReadyButton, RandomButton } from "./buttons/buttons.js";
import { CopyButton } from "../utility/component.js";


import "./pregame.css";

export function pregameView(
	gameId: string,
) {
	const container = document.createElement("div");

	
	const gameIdDiv = document.createElement("div");
	gameIdDiv.className = "pregame-game-id";
	const idSpan = document.createElement("span");
	idSpan.textContent = `Game ID: ${gameId}`;
	
	const copyBtn = new CopyButton(idSpan, el => (el.textContent ?? "").split(":")[1].trim());

	idSpan.appendChild(copyBtn.html); 
	gameIdDiv.appendChild(idSpan);
	gameIdDiv.appendChild(copyBtn.html);
	container.appendChild(gameIdDiv);
	
	const gameArea = document.createElement("section");
	gameArea.id = "pregame-game-area";
	gameArea.classList.add("game-area");

	const buttonBar = document.createElement("section");
	buttonBar.id = "pregame-button-bar";
	buttonBar.classList.add("button-bar");
	
	const gameGrid = new BattleGrid(new Grid(10, 10));
	gameArea.appendChild(gameGrid.html);
	
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

	gameArea.appendChild(garage.html);
	
	const readyButton = new ReadyButton(garage);
	buttonBar.appendChild(readyButton.html);
	
	
	const resetButton = new ResetButton(gameGrid, garage);
	buttonBar.appendChild(resetButton.html);


	const randomButton = new RandomButton(gameGrid, garage);
	buttonBar.appendChild(randomButton.html);

	container.appendChild(buttonBar);
	container.appendChild(gameArea);
	
	return container;
}




