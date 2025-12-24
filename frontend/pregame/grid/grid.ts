import { Component } from "../utility/component.js";

export class Grid extends Component {
	html!: HTMLTableElement;

	constructor(readonly rows: number, readonly cols: number) {
		super();
		this.update_html();
	}

	render(): HTMLTableElement {
		const table = document.createElement("table");
		table.className = "grid";

		for (let r = 0; r < this.rows; r++) {
			const tr = document.createElement("tr");
			for (let c = 0; c < this.cols; c++) {
				const td = document.createElement("td");
				td.className = "cell";
				tr.appendChild(td);
			}
			table.appendChild(tr);
		}

		return table;
	}
}
