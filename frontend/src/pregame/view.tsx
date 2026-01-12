import { Ship, GameId, apiModels, Orientation } from "../base";

import { BattleGrid } from "./battle_grid/battle_grid.js";
import { ShipGarage } from "./garage/garage.js";
import { ButtonBar } from "./buttons/button_bar.js";
import { ReadyContextProvider} from "./context.js";
import { useLoaderData } from "react-router-dom";

import "./pregame.css";

export interface PreGameViewLoaderData {
	gameParams: apiModels.GameParams;
	gameId: string;
}

const PreGameView: React.FC = () => {
	const { gameParams, gameId } = useLoaderData<PreGameViewLoaderData>();

	const submittedShips = new Map(gameParams.ownShips?.map(ship => [new Ship(ship.length, ship.orientation as Orientation), {headRow: ship.headRow, headCol: ship.headCol}]));

	const battleGrid = new BattleGrid({rows: gameParams.battleGridRows, cols: gameParams.battleGridCols}, submittedShips);
	
	const garageShips = gameParams.ownShips.length ? [] : gameParams.shipLengths.map(length => new Ship(length))
	
	const shipGarage = new ShipGarage( garageShips );

	
	if (battleGrid.grid.cols < shipGarage.maxLen && battleGrid.grid.cols < shipGarage.maxLen) {
		throw new Error("Some garage ships do not fit in the game grid");
	}

	if (
		shipGarage.shipArray.length > battleGrid.grid.rows &&
		shipGarage.shipArray.length > battleGrid.grid.cols
	) {
		throw new Error("Too many ships for the game grid");
	}
	
	return (
		<>
			<GameId gameId={gameId} />
			<ReadyContextProvider gameId={gameId}>	
				<ButtonBar battleGrid={battleGrid} shipGarage={shipGarage}/>
				<section className="game-area">
					<battleGrid.Renderer/>
					<shipGarage.Renderer/>
				</section>
			</ReadyContextProvider>
		</>
	);
}


export default PreGameView;

