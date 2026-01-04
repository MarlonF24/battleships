import React from "react";

import "./ship.css";
import { makeAutoObservable } from "mobx";
import { observer } from "mobx-react-lite";

export enum Orientation {
	HORIZONTAL = "horizontal",
	VERTICAL = "vertical",
}

export function toggle_orientation(current: Orientation): Orientation;
export function toggle_orientation(current: string): string;
export function toggle_orientation(current: any): any {
    return current === Orientation.HORIZONTAL 
        ? Orientation.VERTICAL
        : Orientation.HORIZONTAL;
}


export interface ShipPosition {
	readonly headRow: number;
	readonly headCol: number;
}


export class Ship  {
	constructor(readonly length: number, public orientation: Orientation = Orientation.HORIZONTAL, public isSuggestion: boolean = false) {
		makeAutoObservable(this);
	}


	public readonly Renderer = observer(({ position, onMouseDown }: { position: ShipPosition, onMouseDown?: React.MouseEventHandler<HTMLDivElement> }) => {
		
		const style = {
			"--ship-length": this.length.toString(),
			"--row": position.headRow.toString(),
			"--col": position.headCol.toString(),
		} as React.CSSProperties;
		
		return (
			<div 
			className={this.isSuggestion ? "ship suggestion" : "ship"} 
			data-orientation={this.orientation} 
			style={style} 
			onMouseDown={onMouseDown}
			/>
		);
	});
	
}


export class ShipDragClone {
	private _orientation: Orientation;
	readonly html: HTMLDivElement;
	readonly length: number

	constructor(readonly originalHTML: HTMLDivElement) {
		this.html = originalHTML.cloneNode(true) as HTMLDivElement;
		
		this._orientation = this.html.dataset.orientation as Orientation;
		
		this.html.classList.add("clone");
		this.html.style.setProperty("--rotation-angle", "0deg");
		
		
		const originalStyles = getComputedStyle(originalHTML);
		
		this.length = parseInt(
			originalStyles.getPropertyValue("--ship-length")
		);
		this.html.style.top = originalStyles.top;
		this.html.style.left = originalStyles.left;
		this.html.style.width = originalStyles.getPropertyValue("width");
		this.html.style.height = originalStyles.getPropertyValue("height");
		
		originalHTML.classList.add("dragged");
		originalHTML.style.pointerEvents = "none";

		originalHTML.ondragstart = (e) => e.preventDefault();
		this.html.ondragstart = (e) => e.preventDefault();

		
		originalHTML.parentElement!.appendChild(this.html);
	}

	get orientation(): Orientation {
		return this._orientation;
	}

	set orientation(value: Orientation) {
		this._orientation = value;
		this.html.dataset.orientation = value;
	}

	move(xShift: number, yShift: number): void {
		const currentLeft = parseFloat(this.html.style.left);
		const currentTop = parseFloat(this.html.style.top);
		
		this.html.style.left = `${currentLeft + xShift}px`;
		this.html.style.top = `${currentTop + yShift}px`;
	}

	rotate(direction: "clockwise" | "counterclockwise"): void {
		this.html.style.setProperty(
			"--rotation-angle",
			`${direction === "clockwise" ? 90 : -90}deg`
		);
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

