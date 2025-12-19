import { Component } from "../component.js";
import { Ship, Orientation } from "../ship/ship.js";
import { Grid } from "../grid/grid.js";

export interface ShipPosition {
  startRow: number;
  startCol: number;
}

export class BattleGrid extends Component {
  private cells: (Ship | null)[][];
  public ships: Map<Ship, ShipPosition>;
  public readonly grid: Grid;

  constructor(grid: Grid, ships?: Map<Ship, ShipPosition>) {
    super();
    this.grid = grid;
    this.cells = Array.from({ length: grid.rows }, () =>
      Array(grid.cols).fill(null)
    );
    this.ships = ships || new Map();
    this.update_html();
  }

  render(): HTMLElement {
    const el = document.createElement("div");
    el.id = "battle-grid";

    el.appendChild(this.grid.html);

    for (const [ship, pos] of this.ships) {
      const ship_el = ship.html;
      ship_el.style.setProperty("--row", pos.startRow.toString());
      ship_el.style.setProperty("--col", pos.startCol.toString());
      el.appendChild(ship_el);
    }
    return el;
  }

  canPlaceShip(ship: Ship, startRow: number, startCol: number) {
    // basic bounds
    if (startRow < 0 || startCol < 0) return false;

    if (ship.orientation === Orientation.HORIZONTAL) {
      if (startCol + ship.length > this.grid.cols) return false;
      for (let c = startCol; c < startCol + ship.length; c++) {
        if (this.cells[startRow][c] !== null) return false;
      }
    } else {
      if (startRow + ship.length > this.grid.rows) return false;
      for (let r = startRow; r < startRow + ship.length; r++) {
        if (this.cells[r][startCol] !== null) return false;
      }
    }

    return true;
  }

  placeShip(ship: Ship, startRow: number, startCol: number) {
    if (!this.canPlaceShip(ship, startRow, startCol))
      throw new RangeError("cannot place ship");

    if (ship.orientation === Orientation.HORIZONTAL) {
      for (let c = startCol; c < startCol + ship.length; c++) {
        this.cells[startRow][c] = ship;
      }
    } else {
      for (let r = startRow; r < startRow + ship.length; r++) {
        this.cells[r][startCol] = ship;
      }
    }

    this.ships.set(ship, { startRow, startCol });
  }
}
