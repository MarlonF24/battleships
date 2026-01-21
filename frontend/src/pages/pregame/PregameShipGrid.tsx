import { useRef, useEffect } from "react";

import { makeObservable } from "mobx";

import { Ship, ShipPosition, ShipGrid } from "../../base/index.js";
import { Dragger } from "./DragDrop/drag.js";
import { observer } from "mobx-react-lite";

import styled from "styled-components";


export abstract class PregameShipGrid  {
	abstract readonly shipInHandler: EventListener;
	abstract readonly className: string;
	readonly shipGrid: ShipGrid;

	constructor(size: {rows: number; cols: number}, ships?: Map<Ship, ShipPosition>, requireGaps: boolean = true) {
		this.shipGrid = new ShipGrid(size, ships, requireGaps);
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


	protected static StyledPregameShipGrid = styled.div.attrs({className: "pregame-ship-grid"})({
		".ship:not(.clone):hover": {
			cursor: "grab",
			background: "#388e3c",
			borderColor: "#1b5e20",
			transform: "scale(1.05)",
			transition: "transform 0.1s, background 0.1s, border-color 0.1s",
		}
	})

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
			<PregameShipGrid.StyledPregameShipGrid className={this.className} >
				<this.shipGrid.Renderer ref={shipGridRef} mouseDownHandlerFactory={(ship) => new Dragger(ship, this).mouseDownHandler} />
			</PregameShipGrid.StyledPregameShipGrid>
		);
	});
}


