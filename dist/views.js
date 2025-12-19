"use strict";
import { Orientation } from './structs.js';
const CELL_SIZE = 30;
// View helpers: stateless pure functions
export function createGridElement(grid) {
    const table = document.createElement('table');
    table.className = 'grid';
    table.style.borderCollapse = 'collapse';
    table.style.borderSpacing = '0';
    for (let r = 0; r < grid.rows; r++) {
        const tr = document.createElement('tr');
        for (let c = 0; c < grid.cols; c++) {
            const td = document.createElement('td');
            td.dataset.row = r.toString();
            td.dataset.col = c.toString();
            td.style.width = `${CELL_SIZE}px`;
            td.style.height = `${CELL_SIZE}px`;
            td.style.border = '1px solid #444';
            td.style.boxSizing = 'border-box';
            td.style.padding = '0';
            tr.appendChild(td);
        }
        table.appendChild(tr);
    }
    return table;
}
export function createShipElement(ship, cellSize = CELL_SIZE, src, position) {
    var _a;
    const el = document.createElement('div');
    el.className = 'ship';
    el.style.boxSizing = 'border-box';
    el.draggable = true;
    el.addEventListener("dragstart", () => {
        el.classList.add('dragging');
        console.log('Ship dragging!', el);
    });
    if (ship.orientation === Orientation.HORIZONTAL) {
        el.style.width = `${ship.length * cellSize}px`;
        el.style.height = `${cellSize}px`;
    }
    else {
        el.style.width = `${cellSize}px`;
        el.style.height = `${ship.length * cellSize}px`;
    }
    // Positioning
    if (src === "battle") {
        el.style.position = 'absolute';
        el.style.left = `${((_a = position.col) !== null && _a !== void 0 ? _a : 0) * cellSize}px`;
        el.style.top = `${position.row * cellSize}px`;
    }
    else if (src === "garage") {
        el.style.position = 'absolute';
        el.style.left = `0px`;
        el.style.top = `${position.row * cellSize}px`;
    }
    return el;
}
export function renderView(grid, container) {
    // Clear and re-render from state (like React/Vue)
    container.innerHTML = '';
    const table = createGridElement(grid.grid);
    table.classList.add('main-grid');
    table.style.position = 'relative';
    table.style.zIndex = '1'; // Ensure grid is below ships
    container.appendChild(table);
    for (const [ship, pos] of grid.ships) {
        const el = createShipElement(ship, CELL_SIZE, "battle", { row: pos.startRow, col: pos.startCol });
        container.appendChild(el);
    }
}
export function renderGarage(garage, container) {
    // Render a grid with rows = ships.length, cols = maxLen
    container.innerHTML = '';
    container.style.position = 'relative';
    const grid = createGridElement({ rows: garage.ships.length, cols: garage.maxLen });
    grid.classList.add('garage-grid');
    grid.style.position = 'relative';
    grid.style.zIndex = '1'; // Ensure grid is below ships
    container.appendChild(grid);
    // Overlay ships in their rows
    garage.ships.forEach((ship, rowIdx) => {
        if (ship) {
            const shipEl = createShipElement(ship, CELL_SIZE, "garage", { row: rowIdx });
            container.appendChild(shipEl);
        }
    });
}
