"use strict";

function createGrid(rows, cols) {
    const grid = document.createElement("table");

    for (let r = 0; r < rows; r++) {
        const row = document.createElement("tr");
    
        for (let c = 0; c < cols; c++) {
            const cell = document.createElement('td');
            row.appendChild(cell);
        }
        grid.appendChild(row);
    }
    grid.classList.add("battleship-grid");
    return grid;
}