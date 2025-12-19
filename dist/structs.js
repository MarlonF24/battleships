"use strict";
export class Grid {
    constructor(rows, cols) {
        this.rows = rows;
        this.cols = cols;
        this.rows = rows;
        this.cols = cols;
    }
}
export class BattleGrid {
    constructor(grid, ships) {
        this.grid = grid;
        this.cells = Array.from({ length: grid.rows }, () => Array(grid.cols).fill(null));
        this.ships = ships || new Map();
    }
    canPlaceShip(ship, startRow, startCol) {
        // basic bounds
        if (startRow < 0 || startCol < 0)
            return false;
        if (ship.orientation === Orientation.HORIZONTAL) {
            if (startCol + ship.length > this.grid.cols)
                return false;
            for (let c = startCol; c < startCol + ship.length; c++) {
                if (this.cells[startRow][c] !== null)
                    return false;
            }
        }
        else {
            if (startRow + ship.length > this.grid.rows)
                return false;
            for (let r = startRow; r < startRow + ship.length; r++) {
                if (this.cells[r][startCol] !== null)
                    return false;
            }
        }
        return true;
    }
    placeShip(ship, startRow, startCol) {
        if (!this.canPlaceShip(ship, startRow, startCol))
            throw new RangeError('cannot place ship');
        if (ship.orientation === Orientation.HORIZONTAL) {
            for (let c = startCol; c < startCol + ship.length; c++) {
                this.cells[startRow][c] = ship;
            }
        }
        else {
            for (let r = startRow; r < startRow + ship.length; r++) {
                this.cells[r][startCol] = ship;
            }
        }
        this.ships.set(ship, { startRow, startCol });
    }
}
export class ShipGarage {
    constructor(ships) {
        this.grid = new Grid(ships.length, Math.max(...ships.map(s => s ? s.length : 0), 1));
        this.ships = ships;
        this.ships.forEach((element) => { if (element)
            element.orientation = Orientation.HORIZONTAL; });
        this.maxLen = this.grid.cols;
    }
    validateRow(row, err_msg) {
        if (row >= this.ships.length || row < 0) {
            throw new RangeError(err_msg);
        }
    }
    canPlaceShip(row) {
        this.validateRow(row, "Invalid row index");
        return this.ships[row] == null;
    }
    takeShip(row) {
        this.validateRow(row, "Tried to take ship out of bounds of garage");
        if (this.canPlaceShip(row)) {
            throw new ReferenceError();
        }
        let ship = this.ships[row];
        this.ships[row] = null;
        return ship;
    }
    placeShip(row, ship) {
        this.validateRow(row, "Tried to place ship out of bounds of garage");
        this.ships[row] = ship;
    }
}
export var Orientation;
(function (Orientation) {
    Orientation["HORIZONTAL"] = "horizontal";
    Orientation["VERTICAL"] = "vertical";
})(Orientation || (Orientation = {}));
export class Ship {
    constructor(length, orientation = Orientation.HORIZONTAL) {
        this.length = length;
        this.orientation = orientation;
        this.length = length;
        this.orientation = orientation;
    }
    rotate() {
        this.orientation === Orientation.HORIZONTAL ? this.orientation = Orientation.VERTICAL : this.orientation = Orientation.HORIZONTAL;
        return this.orientation;
    }
}
