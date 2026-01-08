import { Ship, CopyButton } from "../base/index.js";

import { BattleGrid } from "./battle_grid/battle_grid.js";
import { ShipGarage } from "./garage/garage.js";
import { GameParams } from "../api-client/index.js";
import { ButtonBar } from "./buttons/button_bar.js";
import { ReadyContextProvider} from "./context.js";

import "./pregame.css";
import { useLoaderData } from "react-router-dom";


export interface PreGameViewLoaderData {
	gameParams: GameParams;
	gameId: string;
}

const PreGameView: React.FC = () => {
	
	const { gameParams, gameId } = useLoaderData<PreGameViewLoaderData>();


	const battleGrid = new BattleGrid({rows: gameParams.battleGridRows, cols: gameParams.battleGridCols});
	const shipGarage = new ShipGarage(
		gameParams.shipLengths.map(length => new Ship(length))
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
			<section className="pregame-game-id">
				<span>{`Game ID: ${gameId}`}</span>
				<CopyButton text={gameId}/>
			</section>
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

