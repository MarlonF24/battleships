import { Ship, Orientation } from "../ship/ship.js";
import { ShipGrid } from "./ship_grid.js";

// Interface for drag state
interface DragState {
	clone: Ship;
	lastX: number;
	lastY: number;
	currentCellInfo?: {
		currentCell: HTMLTableCellElement;
		inCellPos: { x: number; y: number };
	};
}

const CELLSIZE = parseInt(
	getComputedStyle(document.documentElement)
		.getPropertyValue("--cell-size")
		.trim()
		.replace("px", "")
);

// Class encapsulating ship drag logic
export class Dragger {
	private state!: DragState;

	constructor(readonly originalShip: Ship, readonly source: ShipGrid) {}

	public mouseDownHandler = (event: MouseEvent) => {
		if (event.button !== 0) return; // only left click

		const originalHTML = this.originalShip.html;

		const clone = new Ship(
			this.originalShip.length,
			this.originalShip.getOrientation()
		);
		const cloneHTML = clone.html;
		cloneHTML.classList.add("clone");

		// Set initial orientation angle to 0
		cloneHTML.style.setProperty("--rotation-angle", "0deg");

		originalHTML.parentElement!.appendChild(cloneHTML);

		const original_styles = getComputedStyle(originalHTML);
		cloneHTML.style.left = original_styles.left;
		cloneHTML.style.top = original_styles.top;
		cloneHTML.style.width = original_styles.getPropertyValue("width");
		cloneHTML.style.height = original_styles.getPropertyValue("height");

		originalHTML.classList.add("dragged");
		originalHTML.style.pointerEvents = "none";

		this.state = {
			clone: clone,
			lastX: event.pageX,
			lastY: event.pageY,
		};

		originalHTML.addEventListener("dragstart", (e) => e.preventDefault());
		cloneHTML.addEventListener("dragstart", (e) => e.preventDefault());
		document.addEventListener("mousemove", this.onMouseMove);
		document.addEventListener("mouseup", this.onMouseUp);
		document.addEventListener("wheel", this.onWheel, { passive: false });
		document.addEventListener("contextmenu", this.onContextMenu);

		document.body.style.cursor = "grabbing";
	};

	private onMouseMove = (e: MouseEvent) => {
		const clone = this.state.clone;

		// Calculate the shift
		const shiftX = e.pageX - this.state.lastX;
		const shiftY = e.pageY - this.state.lastY;

		// Get current position
		const currentLeft = parseInt(clone.html.style.left, 10);
		const currentTop = parseInt(clone.html.style.top, 10);

		// Update the position of the clone
		clone.html.style.left = currentLeft + shiftX + "px";
		clone.html.style.top = currentTop + shiftY + "px";

		// Update last positions
		this.state.lastX = e.pageX;
		this.state.lastY = e.pageY;

		// Check if we've moved out of the current cell
		if (this.state.currentCellInfo) {
			const newInCellX = shiftX + this.state.currentCellInfo.inCellPos.x;
			const newInCellY = shiftY + this.state.currentCellInfo.inCellPos.y;
			this.state.currentCellInfo.inCellPos = { x: newInCellX, y: newInCellY };
			console.log("New in cell position:", newInCellX, newInCellY);
			if (
				newInCellX < 0 ||
				newInCellX > CELLSIZE ||
				newInCellY < 0 ||
				newInCellY > CELLSIZE
			) {
				this.dispatchMouseOver();
			}
		} else {
			this.dispatchMouseOver();
		}
	};

	private dispatchMouseOver() {
		let boundingRect = this.state.clone.html.getBoundingClientRect();

		const cloneLength = this.state.clone.length;
		// For even-length ships, we take the center of the right-/bottom-middle cell
		// this helps for computing a good suggestion position
		if (cloneLength % 2 === 0) {
			if (this.state.clone.getOrientation() === Orientation.HORIZONTAL) {
				var cloneCenter = {
					x: boundingRect.left + CELLSIZE * (cloneLength / 2 + 0.5), // add one pixel
					y: boundingRect.top + boundingRect.height / 2,
				};
			} else {
				var cloneCenter = {
					x: boundingRect.left + boundingRect.width / 2,
					y: boundingRect.top + CELLSIZE * (cloneLength / 2 + 0.5),
				};
			}
		} else {
			var cloneCenter = {
				x: boundingRect.left + boundingRect.width / 2,
				y: boundingRect.top + boundingRect.height / 2,
			};
		}

		// Determine the element under the cursor
		const elementsBelow = document.elementsFromPoint(
			cloneCenter.x,
			cloneCenter.y
		);
		const cell = Array.from(elementsBelow).find((el) =>
			el.classList.contains("cell")
		) as HTMLTableCellElement | undefined;

		if (!cell) {
			this.state.currentCellInfo?.currentCell.dispatchEvent(
				new CustomEvent("ship-out", {
					bubbles: true,
				})
			);
			this.state.currentCellInfo = undefined;
		} else {
			const cellRect = cell.getBoundingClientRect();

			if (cell !== this.state.currentCellInfo?.currentCell) {
				this.state.currentCellInfo?.currentCell.dispatchEvent(
					new CustomEvent("ship-out", {
						bubbles: true,
					})
				);

				cell.dispatchEvent(
					new CustomEvent("ship-over", {
						detail: {
							shipClone: this.state.clone,
							originalShip: this.originalShip,
							source: this.source,
						},
						bubbles: true, // let bubble so that row handlers can catch it
					})
				);

				this.state.currentCellInfo = {
					currentCell: cell,
					inCellPos: {
						x: cloneCenter.x - cellRect.left,
						y: cloneCenter.y - cellRect.top,
					},
				};
				
			} else { // should never happen, as we check for cell change above
				this.state.currentCellInfo!.inCellPos = {
					x: cloneCenter.x - cellRect.left,
					y: cloneCenter.y - cellRect.top,
				};
			}
			console.log(this.state.currentCellInfo.inCellPos);
		}
	}

	private onMouseUp = (e: MouseEvent) => {
		if (e.button === 2) return; // right click

		// Clean up event listeners
		document.removeEventListener("mousemove", this.onMouseMove);
		document.removeEventListener("mouseup", this.onMouseUp);
		document.removeEventListener("wheel", this.onWheel);
		document.removeEventListener("contextmenu", this.onContextMenu);

		this.state.clone.html.remove();

		if (this.state.currentCellInfo) {
			this.state.currentCellInfo.currentCell.dispatchEvent(
				new CustomEvent("ship-placed", {
					bubbles: true,
				})
			);
		} else {
			this.originalShip.html.classList.remove("dragged");
			this.originalShip.html.style.pointerEvents = "auto";
		}

		document.body.style.cursor = "default";
	};

	private onWheel = (e: WheelEvent) => {
		e.preventDefault(); // prevent page scrolling
		const clone = this.state!.clone;
		let angle = parseInt(
			clone.html.style.getPropertyValue("--rotation-angle"),
			10
		);

		e.deltaY > 0 ? (angle += 90) : (angle -= 90);

		clone.rotate();

		clone.html.style.setProperty("--rotation-angle", `${angle}deg`);
		this.state.currentCellInfo?.currentCell.dispatchEvent(
			new CustomEvent("ship-rotate", {
				bubbles: true,
			})
		);
	};

	private onContextMenu = (e: MouseEvent) => {
		e.preventDefault(); // prevent context menu
		const clone = this.state!.clone;

		let angle = parseInt(
			clone.html.style.getPropertyValue("--rotation-angle"),
			10
		);

		angle += 90;

		clone.rotate();

		clone.html.style.setProperty("--rotation-angle", `${angle}deg`);
		this.state.currentCellInfo?.currentCell.dispatchEvent(
			new CustomEvent("ship-rotate", {
				bubbles: true,
			})
		);
	};
}

// function reset_rotation(clone: HTMLElement, angle: number) {
//   if (!(angle % 360 == 0)) return;

//   let transition_style = getComputedStyle(clone).transition;
//   console.log(clone.style.transition);

//   let match = transition_style.match(/transform ([0-9]+(\.[0-9]+)?)s/);
//   if (!match) throw new Error("No transform transition found.");
//   let duration = parseFloat(match[1]);
//   console.log("Duration:", duration);

//   setTimeout(() => {

//   }, 1 + duration * 1000);

//   clone.style.setProperty("transition", transition_style.replace(/transform [0-9]+(\.[0-9]+)?s/, 'transform 0s'));

//   void clone.offsetWidth; // force reflow

//   clone.style.setProperty("--rotation-angle", `0deg`);

//   setTimeout(() => {
//     clone.style.setProperty("transition", transition_style);
//   }, 0);
// }
