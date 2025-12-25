/**
 *  (c) redxam llc and affiliates. Confidential and proprietary.
 *
 *  @oncall dev+Author
 *  @format
 */

"use strict";

import { BattleGrid } from "../battle_grid/battle_grid.js";
import { ShipGarage } from "../garage/garage.js";
import { Component } from "../utility/component.js";

export class ResetButton extends Component {
	constructor(readonly battleGrid: BattleGrid, readonly shipGarage: ShipGarage) {
		super();
		this.update_html();
	}

	render(): HTMLElement {
		const button = document.createElement("button");

		button.textContent = "Reset Board";
		button.onclick = () => {
			// Logic to reset the board goes here
			console.log("Resetting the board....");
			this.battleGrid.reset();
			this.shipGarage.reset();
		};
		return button;
	}
}
