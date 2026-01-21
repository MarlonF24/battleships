import { Ship, socketModels, toggle_orientation, ShipPosition } from "../../../base";

import "./DynamicShip.css";

type Orientation = socketModels.Orientation;

abstract class DynamicShip  {
	protected _orientation: Orientation;
	readonly html: HTMLDivElement;
	readonly length: number

	constructor(readonly original: HTMLDivElement) {
		const originalHTML = original instanceof DynamicShip ? original.html : original;
		
		
		this.html = originalHTML.cloneNode(true) as HTMLDivElement;
	

		this._orientation = parseInt(this.html.dataset.orientation!) as Orientation;
		
		this.length = parseInt(
			this.html.style.getPropertyValue("--length")
		);

	}

	get orientation(): Orientation {
		return this._orientation;
	}

	set orientation(value: Orientation) {
		this._orientation = value;
		this.html.dataset.orientation = value.toString();
	}

	abstract remove(): void;
}


export class ShipDragClone  extends DynamicShip {

	constructor(readonly originalHTML: HTMLDivElement) {
		super(originalHTML);
		this.html.classList.add("clone");
		this.html.style.setProperty("--rotation-angle", "0deg");
		
		
		originalHTML.classList.add("dragged");
		originalHTML.style.pointerEvents = "none";

		originalHTML.ondragstart = (e) => e.preventDefault();
		this.html.ondragstart = (e) => e.preventDefault();

		
		originalHTML.parentElement!.appendChild(this.html);

		const originalStyles = getComputedStyle(originalHTML);
		const newStyles = this.html.style;
		newStyles.width = originalStyles.width;
		newStyles.height = originalStyles.height;
		newStyles.left = originalStyles.left;
		newStyles.top = originalStyles.top;
	}


	move(xShift: number, yShift: number): void {
		const currentLeft = parseFloat(this.html.style.left);
		const currentTop = parseFloat(this.html.style.top);
		
		this.html.style.left = `${currentLeft + xShift}px`;
		this.html.style.top = `${currentTop + yShift}px`;
	}

	rotate(direction: "clockwise" | "counterclockwise"): void {
		const oldAngle = parseInt(this.html.style.getPropertyValue("--rotation-angle"))

		const newAngle = direction === "clockwise" ? oldAngle + 90 : oldAngle - 90;

		this.html.style.setProperty("--rotation-angle", `${newAngle}deg`);

		this.orientation = toggle_orientation(this.orientation);
	}

	remove(): void {
		this.html.remove();
		this.originalHTML.classList.remove("dragged");
		this.originalHTML.style.pointerEvents = "auto";
		document.body.classList.remove("ships-no-pointer");
	}

	get centerCoords(): { x: number; y: number } {
		const rect = this.html.getBoundingClientRect();
		return {
			x: rect.left + rect.width / 2,
			y: rect.top + rect.height / 2,
		};
	}
}

export class ShipSuggestion extends DynamicShip {
	
	constructor(shipElement: ShipDragClone) {
		super(shipElement.html);
		this.html.classList.remove("clone");
		this.html.classList.add("suggestion");
		this.html.style.pointerEvents = "none";
		const style = this.html.style;
		style.removeProperty("--rotation-angle");
		style.left = "";
		style.top = "";
		style.width = "";
		style.height = "";
	}


	suggest(container: Element, position: ShipPosition, enforceOrientation?: Orientation) {
		enforceOrientation && (this.orientation = enforceOrientation);
		
		this.html.style.setProperty("--row", position.headRow.toString());
		this.html.style.setProperty("--col", position.headCol.toString());
		
		container.appendChild(this.html);

	}

	instantiate(): Ship {
		return new Ship(
			this.length,
			this.orientation,
		);
	}

	remove(): void {
		this.html.remove();
	}
}