import React, { useCallback} from "react";

import { useReadyContext, PregameWSPlayerReadyMessage } from "../context.js";
import { BattleGrid } from "../battle_grid/battle_grid.js";
import { ShipGarage } from "../garage/garage.js";
import { Tooltip, TooltipPosition, Ship } from "../../base/index.js";




export interface PregameButtonProps {
	readonly battleGrid: BattleGrid;
	readonly shipGarage: ShipGarage;
}


export const ResetButton: React.FC<PregameButtonProps> = ({battleGrid, shipGarage}) => {
	const clickHandler = (): void => {
			console.log("Resetting the board....");
			battleGrid.clear();
			shipGarage.reset();
	}

	return <button className="btn-danger" onClick={clickHandler}> Reset </button>;
}


interface ReadyButtonProps extends PregameButtonProps {
	numReadyPlayers: number;
}



export const ReadyButton: React.FC<ReadyButtonProps> = ({shipGarage, battleGrid}) => {
	
	const { numReadyPlayers } = useReadyContext();
	
	const clickHandler = useCallback(() => {
		if (shipGarage.ships.size > 0) {
			alert("Please place all ships on the board before readying up.");
			return;
		}
		
		// Final confirmation before readying up
		const confirmed = confirm("Ready to start the game?\n\nOnce ready, you cannot change your ship placement.");
		
		if (!confirmed) {
			return;
		}

		let shipPositions = new Map<number, [number, number]>();
		for (let [ship, position] of battleGrid.ships) {
			shipPositions.set(ship.length, [position.headRow, position.headCol]);
		}

		let WSMessage: PregameWSPlayerReadyMessage = {
			shipPositions: Object.fromEntries(shipPositions)
		};

		let message = JSON.stringify(WSMessage);
		console.log("Sending ready message to backend:", message);
		BackendWebSocket.socket.send(message);
		
		console.log("Player is ready!");
	}, [battleGrid, shipGarage]);



	return (
		<button className="btn-success" onClick={clickHandler}> 
		Ready! <span className="num-ready-players">{`(${numReadyPlayers}/2)`}</span> 
		</button>
	);

	
}

import { BattleGridInfo, RandomBattleGridGenerator } from "./random_grid.js";
import { BackendWebSocket } from "../../base/backend_api.js";

export const RandomButton: React.FC<PregameButtonProps> = ({battleGrid, shipGarage}) => {

	const clickHandler = () => {
		generateRandomBoard();
	};

	const rightClickHandler = (ev: React.MouseEvent<HTMLButtonElement>) => {
		ev.preventDefault();
		generateRandomBoard(true);
	}

	const generateRandomBoard = (resetAll: boolean = false): void => {
		// Logic to randomize ship placement goes here
		const initialShips = Array.from(shipGarage.ships.keys()).concat(
			Array.from(battleGrid.ships.keys())
		);

		initialShips.sort((a, b) => {return b.length - a.length}); //sort ships by length (desc) so that we place longer ships first

		let {rows, cols} = battleGrid.grid


		let nullSolution: BattleGridInfo = {
			shipPositions: new Map(),
			rowGaps: Array.from({ length: rows }, () => {
				const gap = { size: cols, coord: 0 };
				return { largestGap: gap, gaps: [gap] };
			}),
			colGaps: Array.from({ length: cols }, () => {
				const gap = { size: rows, coord: 0 };
				return { largestGap: gap, gaps: [gap] };
			})
		}

		let shipsToPlace = initialShips;

		if (!resetAll) {
			console.log("Randomly placing unplaced ships.");
			for (let [ship, position] of battleGrid.ships) {
				RandomBattleGridGenerator.placeShip(nullSolution, ship, position);
			}

			shipsToPlace = initialShips.filter((ship) => !nullSolution.shipPositions.has(ship));
		} else {
			console.log("Randomly placing all ships.");
		}

		shipsToPlace = shipsToPlace.map((ship) => new Ship(ship.length, ship.orientation)); // to avoid rotation mutations on original ships


		const solution = RandomBattleGridGenerator.DFS(nullSolution, shipsToPlace);

		if (!solution) throw new Error("Error in DFS for random battle grid.");
		shipGarage.clear();
		battleGrid.reset(solution);
	}

	return (
		<button className="btn-primary" onClick={clickHandler} onContextMenu={rightClickHandler}> Randomize Ships
			<Tooltip position={TooltipPosition.TOP} text="Left Click: unplaced ships&#10;Right Click: all ships" />
		</button>
	);
}







