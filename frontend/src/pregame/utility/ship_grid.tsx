import { makeAutoObservable } from "mobx";


import { Grid } from "../grid/grid.js";
import { Ship, ShipPosition } from "../ship/ship.js";
import { Dragger } from "./drag.js";
import { observer } from "mobx-react-lite";




export abstract class ShipGrid {
	abstract readonly shipInHandler: EventListener;

	public ships: Map<Ship, ShipPosition> = new Map(); 

	constructor(readonly grid: Grid) {
		makeAutoObservable(this);
	}

	abstract removeShip(ship: Ship): void;

	abstract containsShip(ship: Ship): boolean;

	abstract placeShip(ship: Ship, position: ShipPosition): void;


	public readonly Renderer = observer(() => {
		return (
			<section>
				<this.grid.Renderer shipInHandler={this.shipInHandler} />
				{Array.from(this.ships.entries()).map(([ship, position]) => (
					<ship.Renderer position={position} onMouseDown={new Dragger(ship, this).mouseDownHandler} />
				))} 
			</section>
		);
	});
}


