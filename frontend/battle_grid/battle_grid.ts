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

    const cells = this.grid.html.getElementsByClassName("cell");
    for (const cell of cells) {
      cell.addEventListener(
        "ship-over",
        new SuggestionHandler(this, cell as HTMLElement).suggestShip
      );
    }

    el.appendChild(this.grid.html);

    for (const [ship, pos] of this.ships) {
      const ship_el = ship.html;
      ship_el.style.setProperty("--row", pos.startRow.toString());
      ship_el.style.setProperty("--col", pos.startCol.toString());
      el.appendChild(ship_el);
    }
    return el;
  }

  canPlaceShip(ship: Ship, startRow: number, startCol: number): boolean {
    // basic bounds
    if (startRow < 0 || startCol < 0) return false;

    if (!this.shipFitsBounds(ship, startRow, startCol)) return false;

    if (!this.shipHasNoOverlap(ship, startRow, startCol)) return false;

    return true;
  }

  shipHasNoOverlap(
    ship: Ship,
    startRow: number = 0,
    startCol: number = 0,
    disregard?: Ship
  ): boolean {
    if (ship.getOrientation() === Orientation.HORIZONTAL) {
      for (let c = startCol; c < startCol + ship.length; c++) {
        const cell = this.cells[startRow][c];
        if (cell && cell !== disregard) {
          return false;
        }
      }
    } else {
      for (let r = startRow; r < startRow + ship.length; r++) {
        const cell = this.cells[r][startCol];
        if (cell && cell !== disregard) {
          return false;
        }
      }
    }

    return true;
  }

  shipFitsBounds(
    ship: Ship,
    startRow: number = 0,
    startCol: number = 0
  ): boolean {
    if (ship.getOrientation() === Orientation.HORIZONTAL) {
      return startCol + ship.length <= this.grid.cols;
    } else {
      return startRow + ship.length <= this.grid.rows;
    }
  }

  placeShip(ship: Ship, startRow: number, startCol: number) {
    if (!this.canPlaceShip(ship, startRow, startCol))
      throw new RangeError("cannot place ship");

    if (ship.getOrientation() === Orientation.HORIZONTAL) {
      for (let c = startCol; c < startCol + ship.length; c++) {
        this.cells[startRow][c] = ship;
      }
    } else {
      for (let r = startRow; r < startRow + ship.length; r++) {
        this.cells[r][startCol] = ship;
      }
    }

    this.ships.set(ship, { startRow, startCol });
    ship.html.style.setProperty("--row", startRow.toString());
    ship.html.style.setProperty("--col", startCol.toString());
    this.html.appendChild(ship.html);
  }

  containsShip(ship: Ship): boolean {
    return this.ships.has(ship);
  }

  removeShip(ship: Ship) {
    const pos = this.ships.get(ship);
    if (!pos) throw new Error("ship not found on grid");

    if (ship.getOrientation() === Orientation.HORIZONTAL) {
      for (let c = pos.startCol; c < pos.startCol + ship.length; c++) {
        this.cells[pos.startRow][c] = null;
      }
    } else {
      for (let r = pos.startRow; r < pos.startRow + ship.length; r++) {
        this.cells[r][pos.startCol] = null;
      }
    }

    this.ships.delete(ship);
    ship.html.remove();
  }
}

interface ShipOverEventDetail {
  original_ship: Ship;
  ship_clone: Ship;
}

interface SuggestionState {
  original_ship?: Ship;
  ship_clone?: Ship;
  current_suggestion?: {
    ship: Ship;
    row: number;
    col: number;
  }
  
}

class SuggestionHandler {
  // private state!: SuggestionState;
  readonly cellRow: number;
  readonly cellCol: number;
  private state: SuggestionState = {};

  constructor(private battleGrid: BattleGrid, private cell: HTMLElement) {
    this.cellRow = (this.cell.parentElement as HTMLTableRowElement).rowIndex;
    this.cellCol = (this.cell as HTMLTableCellElement).cellIndex;
    this.suggestShip = this.suggestShip.bind(this);
  }

  
  
  clearSuggestion() {
    this.state.current_suggestion?.ship.html.remove();
    this.state.current_suggestion = undefined;
  }
  
  suggestShip(event: Event) {
    // prevent multiple suggestions when hovering over the same cell
    if (this.state.current_suggestion) {
      return;
    }

    const detail = (event as CustomEvent<ShipOverEventDetail>).detail;
    
    // clone the clone to be the suggestion ship
    let ship_clone_clone = new Ship(
      detail.ship_clone.length,
      detail.ship_clone.getOrientation()
    );

    
    // initial bounds check
    if (!this.battleGrid.shipFitsBounds(ship_clone_clone)) return;


    let { headRow: inBoundsHeadRow, headCol: inBoundsHeadCol } =
      SuggestionHandler.closestInBoundsPosition(
        this.battleGrid,
        ship_clone_clone,
        this.cellRow,
        this.cellCol
      );

    if (
      this.battleGrid.shipHasNoOverlap(
        ship_clone_clone,
        inBoundsHeadRow,
        inBoundsHeadCol,
        detail.original_ship // disregard the original ship to allow moving ships on their old position
      )
    ) {
      ship_clone_clone.html.classList.add("suggestion");
      ship_clone_clone.html.style.setProperty("--row", inBoundsHeadRow.toString());
      ship_clone_clone.html.style.setProperty("--col", inBoundsHeadCol.toString());
      
      this.battleGrid.html.appendChild(ship_clone_clone.html);

      
      this.state.current_suggestion = {
        ship: ship_clone_clone,
        row: inBoundsHeadRow,
        col: inBoundsHeadCol
      };

      this.cell.addEventListener("ship-out", this.removeSuggestion.bind(this));
      this.cell.addEventListener("ship-rotate", this.rotateSuggestion.bind(this));
      this.cell.addEventListener("ship-placed", this.placeSuggestion.bind(this));
    }

    this.state.original_ship = detail.original_ship;
    this.state.ship_clone = detail.ship_clone;
  }

  
  rotateSuggestion() {
    this.clearSuggestion();
    
    // retry suggestion after rotation
    this.suggestShip(
      new CustomEvent("ship-over", {
        detail: {
          original_ship: this.state.original_ship!,
          ship_clone: this.state.ship_clone!,
        },
        bubbles: false,
      })
    );
  
  }

  placeSuggestion() {
    // case 1: no suggestion to place
    if (!this.state.current_suggestion) {
      const originalShip = this.state.original_ship!;
      
      originalShip.html.classList.remove("dragged");
      originalShip.html.style.pointerEvents = "auto";
      return;
    };
  
    // case 2: place the suggestion
    if (this.battleGrid.containsShip(this.state.original_ship!)) {
      this.battleGrid.removeShip(this.state.original_ship!);
    }

    this.state.original_ship!.html.remove();

    let { ship, row, col } = this.state.current_suggestion!;
    
    this.removeSuggestion();
    
    ship.html.classList.remove("suggestion");

    this.battleGrid.placeShip(ship, row, col);
  }

  removeSuggestion() {
    this.clearSuggestion();
    
    this.cell.removeEventListener("ship-out", this.removeSuggestion.bind(this));
    this.cell.removeEventListener("ship-rotate", this.rotateSuggestion.bind(this));
    this.cell.removeEventListener("ship-placed",this.placeSuggestion.bind(this));
  }

  static closestInBoundsPosition(
    battleGrid: BattleGrid,
    ship: Ship,
    centerRow: number,
    centerCol: number
  ): { headRow: number; headCol: number } {
    if (ship.getOrientation() === Orientation.HORIZONTAL) {
      let lengthOffset = Math.floor(ship.length / 2); // offset from center to head
      let headRow = centerRow;
      let headCol = Math.max(
        0,
        Math.min(centerCol - lengthOffset, battleGrid.grid.cols - ship.length)
      );
      return { headRow, headCol };
    } else {
      let lengthOffset = Math.floor(ship.length / 2); // offset from center to head
      let headRow = Math.max(
        0,
        Math.min(centerRow - lengthOffset, battleGrid.grid.rows - ship.length)
      );
      let headCol = centerCol;
      return { headRow, headCol };
    }
  }
}
