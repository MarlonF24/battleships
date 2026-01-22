import { socketModels, Ship, ShipPosition } from "../../../base";
import { ShipGarage } from "../Garage/Garage.js";
import { BattleGrid } from "../BattleGrid/BattleGrid.js";




export const generateRandomBoard = (battleGrid: BattleGrid, shipGarage: ShipGarage, resetAll: boolean = false): void => {
	// Logic to randomize ship placement goes here
	const initialShips = Array.from(shipGarage.ships.keys()).concat(
		Array.from(battleGrid.ships.keys())
	);

	initialShips.sort((a, b) => {return b.length - a.length}); //sort ships by length (desc) so that we place longer ships first

	let {rows, cols} = battleGrid.size;


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
	shipGarage.shipGrid.clear();
	battleGrid.reset(solution);
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


class RandomBattleGridGenerator {

	static DFS(partialSolution: BattleGridInfo, shipsToPlace: Ship[]): (Map<Ship, ShipPosition> | null) {
		if (shipsToPlace.length === 0) return partialSolution.shipPositions;


		let shipToPlace = shipsToPlace[0];

		const orientations = [socketModels.Orientation.HORIZONTAL, socketModels.Orientation.VERTICAL].sort(() => 0.5 - Math.random()); // quick but imperfect shuffling

		for (let orientation of orientations) {

			shipToPlace.orientation = orientation;
			let {rowGaps, colGaps} = partialSolution;

			const parallelGaps = orientation == socketModels.Orientation.HORIZONTAL ? rowGaps : colGaps;


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

						const cloneSolution = RandomBattleGridGenerator.shallowCopyBattleGridInfo(partialSolution);

						let shipPosition = orientation == socketModels.Orientation.HORIZONTAL ?
							{headRow: candidateParallelIdx, headCol: actualPerp} :
							{headRow: actualPerp, headCol: candidateParallelIdx};


						RandomBattleGridGenerator.placeShip(cloneSolution, shipToPlace, shipPosition, {perpOffset: candidatePerpOffset, gapIdx: candidateGapIdx});

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
			rowGaps: RandomBattleGridGenerator.shallowCopyGapsInfos(battleGridInfo.rowGaps),
			colGaps: RandomBattleGridGenerator.shallowCopyGapsInfos(battleGridInfo.colGaps)
		};
	}

	static shallowCopyGapsInfos(gapsInfos: GapsInfo[]): GapsInfo[] {
		return gapsInfos.map((gapsInfo) => ({
			largestGap: gapsInfo.largestGap,
			gaps: gapsInfo.gaps.slice()
		}));
	}


	static placeShip(battleGridInfo: BattleGridInfo, ship: Ship, position: ShipPosition, {perpOffset, gapIdx}: {perpOffset?: number, gapIdx?: number} = {}): void {

		let {headRow, headCol} = position;

		const [parallelGaps, perpGaps, parallelIdx, perpIdx] = ship.orientation == socketModels.Orientation.HORIZONTAL ? [battleGridInfo.rowGaps, battleGridInfo.colGaps, headRow, headCol] : [battleGridInfo.colGaps, battleGridInfo.rowGaps, headCol, headRow];

		let currentGapIdxs;

		// update gaps also left and right (parallel to the long side) of the ships to account for required gaps in battleship game
		for (let parallelOffset = -1; parallelOffset <= 1; parallelOffset++) {
			
			// skip if out of bounds
			if (parallelIdx + parallelOffset < 0 || parallelIdx + parallelOffset >= parallelGaps.length) continue;
			
			const adjustedParallelIdx = parallelIdx + parallelOffset;
		
			if (gapIdx !== undefined && parallelOffset === 0) currentGapIdxs = [gapIdx];
			else {
				currentGapIdxs = RandomBattleGridGenerator.findGapIdxsForRange(parallelGaps[adjustedParallelIdx], perpIdx - 1, perpIdx + ship.length);
			}

			currentGapIdxs.sort((a, b) => b - a); // sort desc to avoid messing up indices when splicing

			for (let currentGapIdx of currentGapIdxs) {
				const currentGap = parallelGaps[adjustedParallelIdx].gaps[currentGapIdx];
				let adjustedPerpOffset;

				if (perpOffset === undefined || parallelOffset !== 0) {
					// how far into the gap the ship starts?
					adjustedPerpOffset = perpIdx - currentGap.coord;
				} else {
					adjustedPerpOffset = perpOffset;
				}

				// -1 and +1 on ends (the function caps to the actual gap in case of out of bounds) to account for required gaps for battleship game
				RandomBattleGridGenerator.updateSplitGap(parallelGaps[adjustedParallelIdx], currentGapIdx, adjustedPerpOffset - 1, adjustedPerpOffset + ship.length) 


				// again -1 and +1 to account for required gaps
				const desiredStart = perpIdx - 1;
				const desiredEnd = perpIdx + ship.length; 

				const currentGapEnd = currentGap.coord + currentGap.size - 1;

				let gapStart = Math.max(currentGap.coord, desiredStart);
				let gapEnd = Math.min(currentGapEnd, desiredEnd);
				
				
				for (let perp of perpGaps.slice(gapStart, gapEnd + 1)) {
					let hitGapIdxs = RandomBattleGridGenerator.findGapIdxsForRange(perp, adjustedParallelIdx, adjustedParallelIdx);

					if (hitGapIdxs.length === 0) throw new Error("Inconsistent gap data structure detected in RandomBattleGridGenerator.placeShip. No gap found even though one must exist here, as we are currently at the same spot as a parallel gap on the same spot before this placement.");
					
					if (hitGapIdxs.length > 1) throw new Error("Inconsistent gap data structure detected in RandomBattleGridGenerator.placeShip. Multiple gaps found overlapping the same coordinate. Should only be able to find one gap when handing in findGapIdxs(.., x, x).");

					const relativeParrallelIdx = adjustedParallelIdx - perp.gaps[hitGapIdxs[0]].coord;
					
					// here no -1 and +1 since we're cutting out exactly the ship's space in the crossed perp gaps the -1 and +1 will be done across the iterations of the outer most loop
					RandomBattleGridGenerator.updateSplitGap(perp, hitGapIdxs[0], relativeParrallelIdx, relativeParrallelIdx);
				}
			}
		}

		battleGridInfo.shipPositions.set(ship, position);
	}

	// returns all gap idcx that contain at least a part of the range start-end (inclusive)
	static findGapIdxsForRange(gapsInfo: GapsInfo, start: number, end: number): number[] {
		return gapsInfo.gaps.reduce((acc, gap, idx) => {
			const gapEnd = gap.coord + gap.size - 1;
			
			if (!(end < gap.coord || start > gapEnd)) {
				acc.push(idx);
			}
			return acc;
		}, [] as number[]);
	}


	//inclusive end idx for the piece thats cut out
	static updateSplitGap(gapsInfo: GapsInfo, gapToSplitIdx: number, startIdx: number, endIdx: number, ): void {
		const gap = gapsInfo.gaps[gapToSplitIdx];

		// cap to gap boundaries
		startIdx = Math.max(0, startIdx);
		endIdx = Math.min(gap.size - 1, endIdx);

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
