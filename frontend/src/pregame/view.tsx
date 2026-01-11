import { Ship, GameId } from "../base/index.js";

import { BattleGrid } from "./battle_grid/battle_grid.js";
import { ShipGarage } from "./garage/garage.js";
import { PregameParams } from "../api-client/index.js";
import { ButtonBar } from "./buttons/button_bar.js";
import { ReadyContextProvider} from "./context.js";

import "./pregame.css";
import { useLoaderData } from "react-router-dom";


export interface PreGameViewLoaderData {
	preGameParams: PregameParams;
	gameId: string;
}

const PreGameView: React.FC = () => {
	
	const { preGameParams, gameId } = useLoaderData<PreGameViewLoaderData>();


	const battleGrid = new BattleGrid({rows: preGameParams.battleGridRows, cols: preGameParams.battleGridCols});
	const shipGarage = new ShipGarage(
		preGameParams.shipLengths.map(length => new Ship(length))
	);

	
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

