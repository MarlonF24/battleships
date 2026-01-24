import React, { useCallback} from "react";
import { observer } from "mobx-react-lite";

import {  PregameWebSocketStore } from "../PregameWebsocket.js";
import { BattleGrid } from "../BattleGrid/BattleGrid.js";
import { ShipGarage } from "../Garage/Garage.js";
import { useWebSocketStore, Tooltip, TooltipPosition, Button } from "../../../base";
import { generateRandomBoard } from "./random_grid.js";

export interface PregameButtonProps {
	readonly battleGrid: BattleGrid;
	readonly shipGarage: ShipGarage;
}


export const ResetButton: React.FC<PregameButtonProps> = ({battleGrid, shipGarage}) => {
	const clickHandler = (): void => {
			console.log("Resetting the board....");
			battleGrid.shipGrid.clear();
			shipGarage.reset();
	}

	return <Button $type="danger" onClick={clickHandler}> Reset </Button>;
}


interface ReadyButtonProps extends PregameButtonProps {
	numReadyPlayers: number;
}



export const ReadyButton: React.FC<ReadyButtonProps> = observer(({shipGarage, battleGrid}) => {
	
	const store = useWebSocketStore(PregameWebSocketStore);

	
	
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

		store.sendPlayerReadyMessage(battleGrid);
		
	}, [battleGrid, shipGarage]);



	return (
		<Button $type="success" onClick={clickHandler} > 
		Ready! <span className="num-ready-players">{`(${store.readyState.numReadyPlayers}/2)`}</span> 
		</Button>
	);

	
})



export const RandomButton: React.FC<PregameButtonProps> = ({battleGrid, shipGarage}) => {

	const clickHandler = () => {
		generateRandomBoard(battleGrid, shipGarage, false);
	};

	const rightClickHandler = (ev: React.MouseEvent<HTMLButtonElement>) => {
		ev.preventDefault();
		generateRandomBoard(battleGrid, shipGarage, true);
	}


	return (
		<Button $type="primary" onClick={clickHandler} onContextMenu={rightClickHandler}> Randomise Ships
			<Tooltip position={TooltipPosition.TOP} text="Left Click: unplaced ships&#10;Right Click: all ships" />
		</Button>
	);
}







