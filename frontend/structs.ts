"use strict";


export class Grid {
    constructor(readonly rows: number, readonly cols: number) {
        this.rows = rows;
        this.cols = cols;
    }
}


export class BattleGrid {
    private cells: (Ship | null)[][];
    public ships: Map<Ship, { startRow: number; startCol: number }>;
    public readonly grid: Grid;  

    constructor(grid: Grid, ships?: Map<Ship, { startRow: number; startCol: number }>) {
        this.grid = grid;
        this.cells = Array.from({ length: grid.rows }, () => Array(grid.cols).fill(null));
        this.ships = ships || new Map(); 
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
        if (!this.canPlaceShip(ship, startRow, startCol)) throw new RangeError('cannot place ship');

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



export class ShipGarage {
    public ships: (Ship | null)[];
    public readonly grid: Grid;
    readonly maxLen: number;
    
    constructor(ships: (Ship)[]) {
        this.grid = new Grid(ships.length, Math.max(...ships.map(s => s ? s.length : 0), 1));
        this.ships = ships;
        this.ships.forEach((element) => { if (element) element.orientation = Orientation.HORIZONTAL; });
        this.maxLen = this.grid.cols;
    }

    validateRow(row: number, err_msg: string) {
        if (row >= this.ships.length || row < 0) {
            throw new RangeError(err_msg);
        }
    }

    canPlaceShip(row: number) {
        this.validateRow(row, "Invalid row index")
        return this.ships[row] == null;
    }

    takeShip(row: number) {
        this.validateRow(row, "Tried to take ship out of bounds of garage");
        if (this.canPlaceShip(row)) {throw new ReferenceError();}
        let ship = this.ships[row];
        this.ships[row] = null;
        return ship;
    }

    placeShip(row: number, ship: Ship) {
        this.validateRow(row, "Tried to place ship out of bounds of garage");
        this.ships[row] = ship;
    }
}


export enum Orientation {
    HORIZONTAL = "horizontal",
    VERTICAL = "vertical"
}


export class Ship {
    constructor(readonly length: number, public orientation = Orientation.HORIZONTAL) {
        this.length = length;
        this.orientation = orientation;
    }

    rotate() {
        this.orientation === Orientation.HORIZONTAL ? this.orientation = Orientation.VERTICAL : this.orientation = Orientation.HORIZONTAL
        return this.orientation
    }
}


