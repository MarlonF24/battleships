import { Component } from "../utility/component.js";

export enum Orientation {
	HORIZONTAL = "horizontal",
	VERTICAL = "vertical",
}

export function toggle_orientation(current: string): string {
	return current === Orientation.HORIZONTAL
		? Orientation.VERTICAL
		: Orientation.HORIZONTAL;
}

export class Ship extends Component {
	declare html: HTMLDivElement;

	constructor(
		readonly length: number,
		private orientation: Orientation = Orientation.HORIZONTAL
	) {
		super();
		this.update_html();
	}

	getOrientation(): Orientation {
		return this.orientation;
	}

	setOrientation(orientation: Orientation) {
		this.orientation = orientation;
		this.html.dataset.orientation = orientation;
	}

	rotate() {
		this.setOrientation(toggle_orientation(this.orientation) as Orientation);
	}

	render(): HTMLDivElement {
		const el = document.createElement("div");
		el.className = "ship";

		el.dataset.orientation = this.orientation;
		el.style.setProperty("--ship-length", this.length.toString());

		return el;
	}
}
