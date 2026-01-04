import { Ship, Orientation, ShipPosition } from "../ship/ship.js"


interface Gap { // gapsize -> start coordinate of gap in the perp dimension
	size: number,
	coord: number
}

interface GapsInfo {
	largestGap: Gap,
	gaps: Readonly<Gap>[] // gaps ordered by coord (asc)
}

export interface BattleGridInfo {	
	shipPositions: Map<Ship, ShipPosition>;
	rowGaps: GapsInfo[],
	colGaps: GapsInfo[];
}


export class RandomBattleGridGenerator {

	static DFS(partialSolution: BattleGridInfo, shipsToPlace: Ship[]): (Map<Ship, ShipPosition> | null) {
		if (shipsToPlace.length === 0) return partialSolution.shipPositions;


		let shipToPlace = shipsToPlace[0];

		const orientations = Object.values(Orientation).sort(() => 0.5 - Math.random()); // quick but imperfect shuffling

		for (let orientation of orientations) {

			shipToPlace.orientation = orientation;
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

						const cloneSolution = RandomBattleGridGenerator.shallowCopyBattleGridInfo(partialSolution);

						let shipPosition = orientation == Orientation.HORIZONTAL ?
							{headRow: candidateParallelIdx, headCol: actualPerp} :
							{headRow: actualPerp, headCol: candidateParallelIdx};


						RandomBattleGridGenerator.placeShip(cloneSolution, shipToPlace, shipPosition, candidatePerpOffset,candidateGapIdx);

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


	static placeShip(battleGridInfo: BattleGridInfo, ship: Ship, position: ShipPosition, perpOffset?: number, gapIdx?: number): void {

		let {headRow, headCol} = position;

		const [parallelGaps, perpGaps, parallelIdx, perpIdx] = ship.orientation == Orientation.HORIZONTAL ? [battleGridInfo.rowGaps, battleGridInfo.colGaps, headRow, headCol] : [battleGridInfo.colGaps, battleGridInfo.rowGaps, headCol, headRow];

		gapIdx = gapIdx ?? RandomBattleGridGenerator.findGapIdxContainingCoord(parallelGaps[parallelIdx], perpIdx);


		if (!perpOffset) {
			perpOffset = perpIdx - parallelGaps[parallelIdx].gaps[gapIdx].coord
		}

		RandomBattleGridGenerator.updateSplitGap(parallelGaps[parallelIdx], gapIdx, perpOffset, perpOffset + ship.length - 1)

		// update split gaps in crossed perps
		for (let perp of perpGaps.slice(perpIdx, perpIdx + ship.length)) {
			let hitGapIdx = RandomBattleGridGenerator.findGapIdxContainingCoord(perp, parallelIdx);
			const relativeParrallelIdx = parallelIdx - perp.gaps[hitGapIdx].coord

			RandomBattleGridGenerator.updateSplitGap(perp, hitGapIdx, relativeParrallelIdx, relativeParrallelIdx);
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
