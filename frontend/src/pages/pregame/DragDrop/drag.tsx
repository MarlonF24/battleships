import React from "react";

import { Ship, socketModels } from "../../../base";
import { ShipDragClone } from "./DynamicShip.js";
import { ShipInEvent, ShipOutEvent, ShipPlacedEvent, ShipRotatedEvent, EquatorCrossEvent } from "./suggestion_handler.js";
import { PregameShipGrid } from "../PregameShipGrid/PregameShipGrid.js";

// Interface for drag state
interface DragState {
	clone: ShipDragClone;
	lastX: number;
	lastY: number;
	currentCellInfo?: {
		element: HTMLTableCellElement;
		inCellPosition: { x: number; y: number };
	};
}

let CELLSIZE: number;

// Class encapsulating ship drag logic
export class Dragger {
	private state!: DragState;

	constructor(readonly originalShip: Ship, readonly source: PregameShipGrid) {
		CELLSIZE = CELLSIZE ?? parseInt( // here and not global cause vite doesnt load the styles before this module
		getComputedStyle(document.documentElement)
		.getPropertyValue("--cell-size")
		.trim()
		.replace("px", "")
		);

	}

	public mouseDownHandler = (event: React.MouseEvent<HTMLDivElement>) => {
		if (event.button !== 0) return; // only left click

		const originalHTML = event.currentTarget;

		const clone = new ShipDragClone(originalHTML);

		this.state = {
			clone: clone,
			lastX: event.pageX,
			lastY: event.pageY,
		};
	
		document.onmousemove = this.onMouseMove;
		document.onmouseup = this.onMouseUp;
		document.addEventListener("wheel", this.onWheel, { passive: false });
		document.oncontextmenu = this.onContextMenu;

		// Add class to body to disable pointer events for all ships except the dragged one
		document.body.classList.add("ships-no-pointer");

		document.body.style.cursor = "grabbing";
	
	};

	private onMouseMove = (e: MouseEvent) => {
	
		// Calculate the shift
		const shiftX = e.pageX - this.state.lastX;
		const shiftY = e.pageY - this.state.lastY;

		this.state.clone.move(shiftX, shiftY);

		// Update last positions
		this.state.lastX = e.pageX;
		this.state.lastY = e.pageY;

		// Check if we've moved out of the current cell
		if (this.state.currentCellInfo) {
			
			const { x: oldInCellX, y: oldInCellY } = this.state.currentCellInfo.inCellPosition;
			
			const newInCellX = shiftX / CELLSIZE + this.state.currentCellInfo.inCellPosition.x;
			const newInCellY = shiftY / CELLSIZE + this.state.currentCellInfo.inCellPosition.y;
			
			this.state.currentCellInfo.inCellPosition = { x: newInCellX, y: newInCellY };
			// console.log(newInCellX, newInCellY);
			if (
				newInCellX < 0 ||
				newInCellX > 1 ||
				newInCellY < 0 ||
				newInCellY > 1
			) {
				this.dispatchMouseOver();
			} else if (this.state.clone.length % 2 === 0) {
				const [oldCoordToCheck, newCoordToCheck] = this.state.clone.orientation == socketModels.Orientation.HORIZONTAL ? [oldInCellX, newInCellX] : [oldInCellY, newInCellY];
				
				if (oldCoordToCheck >= 0.5  !==  newCoordToCheck >= 0.5) {
				
					this.state.currentCellInfo!.element.dispatchEvent(
						new EquatorCrossEvent({
								inCellPosition: this.state.currentCellInfo.inCellPosition
							},
							true // let bubble so that row handlers can catch it
						)
					);

				}
			}

		} else {
			this.dispatchMouseOver();
		}

	};

	private dispatchMouseOver = () => {
	
		const cloneCenter = this.state.clone.centerCoords;
		

		// Determine the element under the cursor
		const elementsBelow = document.elementsFromPoint(cloneCenter.x, cloneCenter.y);

		const cell = elementsBelow.find((el) =>
			el.classList.contains("cell")
		) as HTMLTableCellElement | undefined;

		if (!cell) {
			this.state.currentCellInfo?.element.dispatchEvent(
				new ShipOutEvent(true)
			);
			this.state.currentCellInfo = undefined;
		} else  {
			const cellRect = cell.getBoundingClientRect(); // could also use modulo computations instead of getting rect again
			
			this.state.currentCellInfo?.element.dispatchEvent(
				new ShipOutEvent(true)
			);

			this.state.currentCellInfo = {
				element: cell,
				inCellPosition: {
					x: (cloneCenter.x - cellRect.left) / CELLSIZE,
					y: (cloneCenter.y - cellRect.top) / CELLSIZE,
				},
			};
			
			cell.dispatchEvent(
				new ShipInEvent(
					{
						clone: this.state.clone,
						originalShip: this.originalShip,
						source: this.source,
						currentTargetCell: this.state.currentCellInfo
					},
					true // let bubble so that row handlers can catch it
				)
			);
				
		} 
	}
	

	private onMouseUp = (e: MouseEvent) => {
		if (e.button === 2) return; // right click

		// Clean up event listeners
		document.removeEventListener("mousemove", this.onMouseMove);
		document.removeEventListener("mouseup", this.onMouseUp);
		document.removeEventListener("wheel", this.onWheel);
		document.removeEventListener("contextmenu", this.onContextMenu);

		this.state.clone.remove();

		if (this.state.currentCellInfo) {
			this.state.currentCellInfo.element.dispatchEvent(
				new ShipPlacedEvent(true)
			); 
		} 

		document.body.classList.remove("ships-no-pointer");
		
		document.body.style.cursor = "default";
	};

	private onWheel = (e: WheelEvent) => {
		e.preventDefault(); // prevent page scrolling
		const clone = this.state!.clone;

		e.deltaY > 0 ? clone.rotate("clockwise") : clone.rotate("counterclockwise");

		this.state.currentCellInfo?.element.dispatchEvent(
			new ShipRotatedEvent(true)
		);
	};

	private onContextMenu = (e: MouseEvent) => {
		e.preventDefault(); // prevent context menu
		const clone = this.state!.clone;

		clone.rotate("clockwise");

		this.state.currentCellInfo?.element.dispatchEvent(
			new ShipRotatedEvent(true)
		);
	};
}

// function reset_rotation(cloneHTML: HTMLElement, angle: number) {
//   if (!(angle % 360 == 0)) return;

//   let transition_style = getComputedStyle(cloneHTML).transition;
//   console.log(cloneHTML.style.transition);

//   let match = transition_style.match(/transform ([0-9]+(\.[0-9]+)?)s/);
//   if (!match) throw new Error("No transform transition found.");
//   let duration = parseFloat(match[1]);
//   console.log("Duration:", duration);

//   setTimeout(() => {

//   }, 1 + duration * 1000);

//   cloneHTML.style.setProperty("transition", transition_style.replace(/transform [0-9]+(\.[0-9]+)?s/, 'transform 0s'));

//   void cloneHTML.offsetWidth; // force reflow

//   cloneHTML.style.setProperty("--rotation-angle", `0deg`);

//   setTimeout(() => {
//     cloneHTML.style.setProperty("transition", transition_style);
//   }, 0);
// }
