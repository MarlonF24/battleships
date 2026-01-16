import React, { useState } from "react";

import { Ship, GameId, apiModels, socketModels, WebSocketProvider } from "../../base";

import { BattleGrid } from "./BattleGrid/battle_grid.js";
import { ShipGarage } from "./Garage/garage.js";
import { ButtonBar } from "./buttons/button_bar.js";
import { useLoaderData } from "react-router-dom";
import { PregameWebSocketStore } from "./PregameWebsocket.js";
import { Page, useSwitchView } from "../../routing/switch_view.js";

import "./pregame.css";
import { useEffect } from "react";

export interface GameViewLoaderData {
	gameParams: apiModels.GameParams;
	gameId: string;
}

const PreGameView: React.FC = () => {
	const { gameParams, gameId } = useLoaderData<GameViewLoaderData>();
	const switchView = useSwitchView();

	const submittedShips = new Map(gameParams.ownShips?.map(ship => [new Ship(ship.length!, ship.orientation as socketModels.Orientation), {headRow: ship.headRow!, headCol: ship.headCol!}]));

	const battleGrid = new BattleGrid({rows: gameParams.battleGridRows, cols: gameParams.battleGridCols}, submittedShips);
	
	const garageShips: Ship[] = [];
	
	if (gameParams.shipLengths) {
		Object.entries(gameParams.shipLengths).reduce((acc, [lengthStr, count]) => {
			const length = parseInt(lengthStr);
			for (let i = 0; i < count; i++) {
				acc.push(new Ship(length, socketModels.Orientation.HORIZONTAL));
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

	const [WS] = useState<PregameWebSocketStore>(() => new PregameWebSocketStore(gameId, () => switchView(Page.ERROR, gameId, "Connection to server lost during pregame phase.")));

	useEffect(() => {
		return () => {
			WS.intentionalDisconnect();
		};
	}, [gameId]);

	
	return (
		<>
			<GameId gameId={gameId} />
			<WebSocketProvider store={WS}>	
				<ButtonBar battleGrid={battleGrid} shipGarage={shipGarage}/>
				<section className="game-area">
					<battleGrid.Renderer/>
					<shipGarage.Renderer/>
				</section>
			</WebSocketProvider>
		</>
	);
}


export default PreGameView;

