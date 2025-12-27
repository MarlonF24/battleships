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
import { Component } from "../utility/component.js";
import { Orientation, Ship } from "../ship/ship.js";

export class ResetButton extends Component {
	constructor(
		readonly battleGrid: BattleGrid,
		readonly shipGarage: ShipGarage
	) {
		super();
		this.update_html();
	}

	render(): HTMLElement {
		const button = document.createElement("button");
		button.id = "reset-button";

		button.textContent = "Reset";
		button.onclick = () => {
			// Logic to reset the board goes here
			console.log("Resetting the board....");
			this.battleGrid.reset();
			this.shipGarage.reset();
		};
		return button;
	}
}

export class ReadyButton extends Component {
	constructor(readonly garage: ShipGarage) {
		super();
		this.update_html();
	}

	render(): HTMLElement {
		const button = document.createElement("button");
		button.id = "ready-button";

		button.textContent = "Ready!";
		button.onclick = this.clickHandler;

		return button;
	}

	clickHandler = () => {
		if (this.garage.ships.size) {
			alert("Please place all ships on the board before readying up.");
			return;
		}
		// Todo: Backend post to signal readiness
		console.log("Player is ready!");
	};
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


var initialShips: Ship[]
 

export class RandomButton extends Component {
	constructor(
		readonly battleGrid: BattleGrid,
		readonly shipGarage: ShipGarage
	) {
		super();
		this.update_html();
	}

	render(): HTMLElement {
		const button = document.createElement("button");
		button.id = "random-button";
		button.textContent = "Randomize Ships";
		button.onclick = this.clickHandler;
		return button;
	}

	clickHandler = () => {
		// Logic to randomize ship placement goes here
		console.log("Randomizing ship placement...");
		
		initialShips = (
			JSON.parse(sessionStorage.getItem("initial-garage")!) as Array<number>
		).map((length) => {
			return new Ship(length);
		});

		initialShips.sort((a, b) => {return b.length - a.length}); //sort ships by length (desc) so that we place longer ships first
		
		let {rows, cols} = this.battleGrid.grid
		
		let initialRowGap: Gap = {size: cols, coord: 0};
		let intialColGap: Gap = {size: rows, coord: 0};

		let nullSolution: BattleGridInfo = {
			shipPositions: new Map(),
			rowGaps: new Array<GapsInfo>(rows).fill(
				{largestGap: initialRowGap,
					gaps: [initialRowGap]
				}
			),
			
			colGaps: new Array<GapsInfo>(cols).fill(
				{largestGap: intialColGap,
					gaps: [intialColGap]
				}
			)
		}

		console.clear()
		
		const solution = this.DFS(nullSolution, 0);

		if (!solution) throw new Error("Error in DFS for random battle grid.");
		console.log(...solution.values(), ...solution.keys())
		this.shipGarage.clear();
		this.battleGrid.reset(solution);
	};



	DFS(partialSolution: BattleGridInfo, depth: number): (Map<Ship, ShipPosition> | null) {
		if (depth >= initialShips.length) return partialSolution.shipPositions;
		
		
		let shipToPlace = initialShips[depth]; 

		const orientation = Object.values(Orientation)[RandomButton.randInt(0, 1)];

		shipToPlace.setOrientation(orientation);
		
		let {shipPositions, rowGaps, colGaps} = partialSolution;

		const parallelGaps = orientation == Orientation.HORIZONTAL ? rowGaps : colGaps;  

		
		let candidateParallelIdxs = parallelGaps.reduce((acc, value, index) => {
			if (value.largestGap.size >= shipToPlace.length) acc.push(index);
			return acc;
			},  Array<number>());
		
		candidateParallelIdxs.sort(() => 0.5 - Math.random()); // quick but imperfect shuffling

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
					
					const cloneSolution = {
						shipPositions: new Map(shipPositions),
						rowGaps: RandomButton.shallowCopyGapsInfos(rowGaps),
						colGaps: RandomButton.shallowCopyGapsInfos(colGaps)
					}
					
					let shipPosition = orientation == Orientation.HORIZONTAL ? 
					{startRow: candidateParallelIdx, startCol: actualPerp} :
					{startRow: actualPerp, startCol: candidateParallelIdx}
					

					cloneSolution.shipPositions.set(shipToPlace, shipPosition);
		

					const [parallelCloneGaps, perpCloneGaps] = orientation == Orientation.HORIZONTAL ? [cloneSolution.rowGaps, cloneSolution.colGaps] : [cloneSolution.colGaps, cloneSolution.rowGaps];  

					RandomButton.updateSplitGap(parallelCloneGaps[candidateParallelIdx], candidateGapIdx, candidatePerpOffset, candidatePerpOffset + shipToPlace.length - 1)


					// update split gaps in crossed perps 
					for (let perp of perpCloneGaps.slice(actualPerp, actualPerp + shipToPlace.length)) {
						let hitGapIdx = perp.gaps.findIndex((gap) => gap.coord > candidateParallelIdx);
						
						hitGapIdx = hitGapIdx === -1 ? perp.gaps.length - 1 : hitGapIdx - 1; // found -> go one back, not-found -> last element

						const relativeParrallelIdx = candidateParallelIdx - perp.gaps[hitGapIdx].coord

						RandomButton.updateSplitGap(perp, hitGapIdx, relativeParrallelIdx, relativeParrallelIdx);							
					}
					
					// recursive call
					const result = this.DFS(cloneSolution, depth + 1);

					if (result) return result;
					
				}
			}
		}
		
		return null;
	};


	static shallowCopyGapsInfos(gapsInfos: GapsInfo[]): GapsInfo[] {
		return gapsInfos.map((gapsInfo) => ({
			largestGap: gapsInfo.largestGap,
			gaps: gapsInfo.gaps.slice()
		}));
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
		if (gap == gapsInfo.largestGap) {
			gapsInfo.largestGap = gapsInfo.gaps.reduce((currLargestGap, currGap) => currLargestGap.size < currGap.size ? currGap : currLargestGap, {size: 0, coord: 0})
		}
	}

	static randInt = (min: number, max: number): number =>
		Math.floor(Math.random() * (max - min + 1)) + min;
}
