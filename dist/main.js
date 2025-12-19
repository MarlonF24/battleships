"use strict";
import * as Structs from "./structs.js";
import * as Views from "./views.js";
const container = document.getElementById("grid");
container.style.position = "relative";
// example initialization
const gameGrid = new Structs.BattleGrid(new Structs.Grid(10, 10));
Views.renderView(gameGrid, container);
const garageContainer = document.getElementById("ship-garage");
const garage = new Structs.ShipGarage([
    new Structs.Ship(5), new Structs.Ship(4), new Structs.Ship(3)
]);
Views.renderGarage(garage, garageContainer);
