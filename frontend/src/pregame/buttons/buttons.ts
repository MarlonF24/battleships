/**
 *  (c) redxam llc and affiliates. Confidential and proprietary.
 *
 *  @oncall dev+Author
 *  @format
 */

"use strict";

import { ShipPosition } from "../utility/ship_grid.js";
import { BattleGrid } from "../battle_grid/battle_grid.js";
import { ShipGarage } from "../garage/garage.js";
import { Button, Tooltip, TooltipPosition } from "../../utility/component.js";
import { Orientation, Ship } from "../ship/ship.js";

import "./buttons.css";

export class ResetButton extends Button {
       constructor(
	       readonly battleGrid: BattleGrid,
	       readonly shipGarage: ShipGarage
       ) {
	       super("Reset");
	       this.update_html();
       }


	clickHandler = (e: MouseEvent): void => {
			console.log("Resetting the board....");
			this.battleGrid.reset();
			this.shipGarage.reset();
	}
}


export class ReadyButton extends Button {
    private readyPlayersSpan!: HTMLSpanElement;
	
	constructor(readonly garage: ShipGarage) {
	       super("Ready!", false);
	       this.update_html();
       }



	clickHandler = () => {
		if (this.garage.ships.size) {
			alert("Please place all ships on the board before readying up.");
			return;
		}
		// Todo: Backend post to signal readiness
		console.log("Player is ready!");
	};

	render(): HTMLButtonElement {
		const button = super.render();
		const readySpan = document.createElement("span");
		
		this.readyPlayersSpan = readySpan;
		readySpan.className = "ready-players-count";
		readySpan.textContent = "(0/2)"; // Placeholder text, to be updated with actual ready count
		
		button.appendChild(readySpan);
		return button;
	}

	
}

interface Gap { // gapsize -> start coordinate of gap in the perp dimension
	size: number,
	coord: number
}

interface GapsInfo {
	largestGap: Gap,
	gaps: Readonly<Gap>[] // gaps ordered by coord (asc)
}

interface BattleGridInfo {	
	shipPositions: Map<Ship, ShipPosition>;
	rowGaps: GapsInfo[],
	colGaps: GapsInfo[];
}



export class RandomButton extends Button {
       constructor(
	       readonly battleGrid: BattleGrid,
	       readonly shipGarage: ShipGarage
       ) {
	       super("Randomize Ships");
	       this.update_html();
       }

	render(): HTMLButtonElement {
		const button = super.render();
		button.addEventListener("contextmenu", this.rightClickHandler);

		// Tooltip setup
		const tooltip = new Tooltip("Left Click: unplaced ships\nRight Click: all ships", TooltipPosition.TOP);
		button.classList.add("has-tooltip");
		button.appendChild(tooltip.html);

		return button;
	}

	clickHandler = () => {
		this.generateRandomBoard();
	};

	rightClickHandler = (ev: MouseEvent) => {
		ev.preventDefault();
		this.generateRandomBoard(true);
	}

	generateRandomBoard(resetAll: boolean = false): void {
		// Logic to randomize ship placement goes here		
		const initialShips = Array.from(this.shipGarage.ships.keys()).concat(
			Array.from(this.battleGrid.ships.keys())
		);

		initialShips.sort((a, b) => {return b.length - a.length}); //sort ships by length (desc) so that we place longer ships first
		
		let {rows, cols} = this.battleGrid.grid
		

		let nullSolution: BattleGridInfo = {
			shipPositions: new Map(),
			rowGaps: Array.from({ length: rows }, () => {
            const gap = { size: cols, coord: 0 };
            return { largestGap: gap, gaps: [gap] };
        }
	),
        colGaps: Array.from({ length: cols }, () => {
            const gap = { size: rows, coord: 0 };
            return { largestGap: gap, gaps: [gap] };
        }
	)
	}

		let shipsToPlace = initialShips;

		if (!resetAll) {
			console.log("Randomly placing unplaced ships.");
			for (let [ship, position] of this.battleGrid.ships) {
				RandomButton.placeShip(nullSolution, ship, position); 
			}
		
			shipsToPlace = initialShips.filter((ship) => !nullSolution.shipPositions.has(ship));
		} else {
			console.log("Randomly placing all ships.");
		}

		shipsToPlace = shipsToPlace.map((ship) => new Ship(ship.length, ship.getOrientation())); // to avoid rotation mutations on original ships

		
		const solution = this.DFS(nullSolution, shipsToPlace);

		if (!solution) throw new Error("Error in DFS for random battle grid.");
		this.shipGarage.clear();
		this.battleGrid.reset(solution);
	}

	DFS(partialSolution: BattleGridInfo, shipsToPlace: Ship[]): (Map<Ship, ShipPosition> | null) {
		if (shipsToPlace.length === 0) return partialSolution.shipPositions;
		
		
		let shipToPlace = shipsToPlace[0]; 
		
		const orientations = Object.values(Orientation).sort(() => 0.5 - Math.random()); // quick but imperfect shuffling
		
		for (let orientation of orientations) {
		
			shipToPlace.setOrientation(orientation);
			let {rowGaps, colGaps} = partialSolution;

			const parallelGaps = orientation == Orientation.HORIZONTAL ? rowGaps : colGaps;  

			
			let candidateParallelIdxs = parallelGaps.reduce((acc, value, index) => {
				if (value.largestGap.size >= shipToPlace.length) acc.push(index);
				return acc;
				},  Array<number>());
			
			candidateParallelIdxs.sort(() => 0.5 - Math.random()); 

			for (const candidateParallelIdx of candidateParallelIdxs) {
				const candidateGaps = parallelGaps[candidateParallelIdx].gaps
				const candidateGapsIdxs = candidateGaps.flatMap((gap, idx) => gap.size >= shipToPlace.length ? [idx] : []);
				
				candidateGapsIdxs.sort(() => 0.5 - Math.random()); 

				for (let candidateGapIdx of candidateGapsIdxs) {
					const candidateGap = candidateGaps[candidateGapIdx]
					
					const candidatePerpOffsets = Array.from(
					{ length: candidateGap.size - shipToPlace.length + 1 },
					(_, i) => i
					);

					candidatePerpOffsets.sort(() => 0.5 - Math.random());

					for (const candidatePerpOffset of candidatePerpOffsets) {
						const actualPerp = candidateGap.coord + candidatePerpOffset
						
						const cloneSolution = RandomButton.shallowCopyBattleGridInfo(partialSolution);
						
						let shipPosition = orientation == Orientation.HORIZONTAL ? 
							{startRow: candidateParallelIdx, startCol: actualPerp} :
							{startRow: actualPerp, startCol: candidateParallelIdx};
						
						
						RandomButton.placeShip(cloneSolution, shipToPlace, shipPosition, candidatePerpOffset,candidateGapIdx);

						// recursive call
						const result = this.DFS(cloneSolution, shipsToPlace.slice(1));

						if (result) return result;
						
					}
				}
			}
		}
	return null;
	};


	static shallowCopyBattleGridInfo(battleGridInfo: BattleGridInfo): BattleGridInfo {
		return {
			shipPositions: new Map(battleGridInfo.shipPositions),
			rowGaps: RandomButton.shallowCopyGapsInfos(battleGridInfo.rowGaps),
			colGaps: RandomButton.shallowCopyGapsInfos(battleGridInfo.colGaps)
		};
	}

	static shallowCopyGapsInfos(gapsInfos: GapsInfo[]): GapsInfo[] {
		return gapsInfos.map((gapsInfo) => ({
			largestGap: gapsInfo.largestGap,
			gaps: gapsInfo.gaps.slice()
		}));
	}


	static placeShip(battleGridInfo: BattleGridInfo, ship: Ship, position: ShipPosition, perpOffset?: number, gapIdx?: number): void {
		
		let {startRow, startCol} = position;

		const [parallelGaps, perpGaps, parallelIdx, perpIdx] = ship.getOrientation() == Orientation.HORIZONTAL ? [battleGridInfo.rowGaps, battleGridInfo.colGaps, startRow, startCol] : [battleGridInfo.colGaps, battleGridInfo.rowGaps, startCol, startRow];  

		gapIdx = gapIdx ?? RandomButton.findGapIdxContainingCoord(parallelGaps[parallelIdx], perpIdx);
		
		
		if (!perpOffset) {
			perpOffset = perpIdx - parallelGaps[parallelIdx].gaps[gapIdx].coord
		}

		RandomButton.updateSplitGap(parallelGaps[parallelIdx], gapIdx, perpOffset, perpOffset + ship.length - 1)

		// update split gaps in crossed perps 
		for (let perp of perpGaps.slice(perpIdx, perpIdx + ship.length)) {
			let hitGapIdx = RandomButton.findGapIdxContainingCoord(perp, parallelIdx);

			const relativeParrallelIdx = parallelIdx - perp.gaps[hitGapIdx].coord

			RandomButton.updateSplitGap(perp, hitGapIdx, relativeParrallelIdx, relativeParrallelIdx);							
		}
		
		battleGridInfo.shipPositions.set(ship, position);
	}


	static findGapIdxContainingCoord(gapsInfo: GapsInfo, coord: number): number {
		let hitGapIdx = gapsInfo.gaps.findIndex((gap) => gap.coord > coord);
		return hitGapIdx === -1 ? gapsInfo.gaps.length - 1 : hitGapIdx - 1; // found -> go one back, not-found -> last element
	}


	//inclusive end idx for the piece thats cut out
	static updateSplitGap(gapsInfo: GapsInfo, gapToSplitIdx: number, startIdx: number, endIdx: number): void {
		const gap = gapsInfo.gaps[gapToSplitIdx];

		const splits =  [ // get two new resulting gaps from placement in chosen gap
							{size: startIdx, coord: gap.coord}, 
							{size: gap.size - (endIdx + 1), 
							coord: gap.coord + endIdx + 1 }
						].filter(({size}) => size > 0) // filter out size 0-size remaining gaps

		gapsInfo.gaps.splice(gapToSplitIdx, 1, ...splits); // replace candidate Gap with remainders

		// update largest gap
		if (gap.size == gapsInfo.largestGap.size) {
			gapsInfo.largestGap = gapsInfo.gaps.reduce((currLargestGap, currGap) => currLargestGap.size < currGap.size ? currGap : currLargestGap, {size: 0, coord: 0})
		}
	}

}
