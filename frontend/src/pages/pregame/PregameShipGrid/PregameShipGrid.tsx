import { useRef, useEffect } from "react";

import { makeObservable } from "mobx";


import { Ship, ShipPosition, ShipGrid } from "../../../base";
import { Dragger } from "../DragDrop/drag.js";
import { observer } from "mobx-react-lite";

import "./PregameShipGrid.css";

export abstract class PregameShipGrid  {
	abstract readonly shipInHandler: EventListener;
	abstract readonly styleClassName: string;
	readonly shipGrid: ShipGrid;

	constructor(size: {rows: number; cols: number}, ships?: Map<Ship, ShipPosition>) {
		this.shipGrid = new ShipGrid(size, ships);
		makeObservable(this, {
			reset: true,
		});
	}

	get ships(): Map<Ship, ShipPosition> {
		return this.shipGrid.ships;
	}

	get size(): {rows: number; cols: number} {
		return this.shipGrid.size;
	}

	get shipCells(): (Ship | null)[][] {
		return this.shipGrid.shipCells;
	}


	abstract reset(): void;


	public readonly Renderer = observer(() => {
		const shipGridRef = useRef<HTMLDivElement>(null);
		
		useEffect(() => {
			const shipGrid = shipGridRef.current!;
			
			shipGrid.addEventListener("ship-in", this.shipInHandler);
			return () => {
				shipGrid.removeEventListener("ship-in", this.shipInHandler);
			}
		}, [this.shipInHandler]);
		
		return (
			<div className={`${this.styleClassName} pregame-ship-grid`}>
				<this.shipGrid.Renderer ref={shipGridRef} mouseDownHandlerFactory={(ship) => new Dragger(ship, this).mouseDownHandler} />
			</div>
		);
	});
}


