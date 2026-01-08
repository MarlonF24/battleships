import { useRef, useEffect } from "react";

import { action, makeObservable } from "mobx";


import { Ship, ShipPosition, ShipGrid, Grid } from "../../base/index.js";
import { Dragger } from "../drag_drop/drag.js";
import { observer } from "mobx-react-lite";


export abstract class PregameShipGrid  {
	abstract readonly shipInHandler: EventListener;
	readonly shipGrid: ShipGrid;

	constructor(size: {rows: number; cols: number}) {
		this.shipGrid = new ShipGrid(size);
		makeObservable(this, {
			removeShip: action,
			containsShip: action,
			placeShip: action,
			reset: action,
			clear: action
		});
	}

	get ships(): Map<Ship, ShipPosition> {
		return this.shipGrid.ships;
	}

	get grid(): Grid {
		return this.shipGrid.grid;
	}

	abstract removeShip(ship: Ship): void;

	abstract containsShip(ship: Ship): boolean;

	abstract placeShip(ship: Ship, position: ShipPosition): void;

	abstract reset(): void;

	clear() {
		this.ships.forEach((_, ship) => {this.removeShip(ship);})
	}

	public readonly Renderer = observer(() => {
		const divRef = useRef<HTMLDivElement>(null);
		
		useEffect(() => {
			const tbody = divRef.current!;
			
			tbody.addEventListener("ship-in", this.shipInHandler);
			return () => {
				tbody.removeEventListener("ship-in", this.shipInHandler);
			}
		}, [this.shipInHandler]);
		
		return (
			<div ref={divRef} className={this.constructor.name} style={{position: "relative"}}>
				<this.shipGrid.Renderer mouseDownHandlerFactory={(ship) => new Dragger(ship, this).mouseDownHandler} />
			</div>
		);
	});
}


