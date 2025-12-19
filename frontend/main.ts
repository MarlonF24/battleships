import { BattleGrid } from "./battle_grid/battle_grid.js";
import { Grid } from "./grid/grid.js";
import { ShipGarage } from "./garage/garage.js";    
import { Ship } from "./ship/ship.js";

const container: HTMLElement = document.getElementById("main-flex")!;
container.style.position = "relative";


function renderView(container: HTMLElement, battle_grid: BattleGrid, ship_garage: ShipGarage) {
  container.innerHTML = "";
  container.appendChild(battle_grid.html);
  container.appendChild(ship_garage.html);
}


// example initialization
const gameGrid = new BattleGrid(new Grid(10, 10));

const garage = new ShipGarage([
  new Ship(5),
  new Ship(4),
  new Ship(3),
]);


renderView(container, gameGrid, garage);