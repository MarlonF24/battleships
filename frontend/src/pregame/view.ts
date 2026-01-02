import { BattleGrid } from "./battle_grid/battle_grid.js";
import { Grid } from "./grid/grid.js";
import { ShipGarage } from "./garage/garage.js";
import { Ship } from "./ship/ship.js";
import { ResetButton, ReadyButton, RandomButton } from "./buttons/buttons.js";
import { CopyButton } from "../utility/component.js";
import { GameParams } from "../api-client/index.js";

import "./pregame.css";





export function pregameView(
	gameId: string,
	params: GameParams
) {
	const { battleGridRows, battleGridCols, shipLengths } = params;
	
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
	
	const gameGrid = new BattleGrid(new Grid(battleGridRows, battleGridCols));
	gameArea.appendChild(gameGrid.html);
	
	const garage = new ShipGarage(
		shipLengths.map(length => new Ship(length))
	);

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
	
	const readyButton = new ReadyButton(garage, gameGrid);
	buttonBar.appendChild(readyButton.html);
	
	
	const resetButton = new ResetButton(gameGrid, garage);
	buttonBar.appendChild(resetButton.html);


	const randomButton = new RandomButton(gameGrid, garage);
	buttonBar.appendChild(randomButton.html);

	const eventContainer = document.createElement("div");
	eventContainer.id = "pregame-event-container";
	eventContainer.classList.add("event-container");
	
	eventContainer.appendChild(buttonBar);
	eventContainer.appendChild(gameArea);
	container.appendChild(eventContainer);
	
	return container;
}




