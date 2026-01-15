import { Ship, GameId, apiModels, Orientation } from "../../base";

import { BattleGrid } from "./BattleGrid/battle_grid.js";
import { ShipGarage } from "./Garage/garage.js";
import { ButtonBar } from "./buttons/button_bar.js";
import { ReadyContextProvider} from "./ReadyContext.js";
import { useLoaderData } from "react-router-dom";

import "./pregame.css";

export interface GameViewLoaderData {
	gameParams: apiModels.GameParams;
	gameId: string;
}

const PreGameView: React.FC = () => {
	const { gameParams, gameId } = useLoaderData<GameViewLoaderData>();

	const submittedShips = new Map(gameParams.ownShips?.map(ship => [new Ship(ship.length!, ship.orientation as Orientation), {headRow: ship.headRow!, headCol: ship.headCol!}]));

	const battleGrid = new BattleGrid({rows: gameParams.battleGridRows, cols: gameParams.battleGridCols}, submittedShips);
	
	const garageShips: Ship[] = [];
	
	if (gameParams.shipLengths) {
		const garage = Object.entries(gameParams.shipLengths).reduce((acc, [lengthStr, count]) => {
			const length = parseInt(lengthStr);
			for (let i = 0; i < count; i++) {
				acc.push(new Ship(length));
			}
			return acc;
		}, garageShips);
	}
	
	const shipGarage = new ShipGarage( garageShips );

	if (battleGrid.size.cols < shipGarage.size.cols && battleGrid.size.rows < shipGarage.size.rows) {
		throw new Error("Some garage ships do not fit in the game grid");
	}

	if (
		shipGarage.size.rows > battleGrid.size.rows &&
		shipGarage.size.cols > battleGrid.size.cols
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

