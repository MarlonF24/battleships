import React from "react";
import { observer } from "mobx-react-lite";
import { socketModels } from "../../../backend_api";

import "./ship.css";

export const Orientation = socketModels.Orientation;

export function toggle_orientation(current: socketModels.Orientation): socketModels.Orientation;
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


export class Ship {
	
	constructor(readonly length: number, public orientation: socketModels.Orientation = Orientation.HORIZONTAL) {
		if (this.orientation === Orientation.UNSPECIFIED) {
			console.warn("Invalid orientation for Ship: UNSPECIFIED. Defaulting to HORIZONTAL.");
		}
	}


	public readonly Renderer = observer(({ position, onMouseDown }: { position: ShipPosition, onMouseDown?: React.MouseEventHandler<HTMLDivElement> }) => {
		
		const style = {
			"--ship-length": this.length.toString(),
			"--row": position.headRow.toString(),
			"--col": position.headCol.toString(),
		} as React.CSSProperties;
		
		return (
			<div className="ship"
			data-orientation={this.orientation} 
			style={style} 
			onMouseDown={onMouseDown}
			/>
		);
	});
	
}