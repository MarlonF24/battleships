
import { makeObservable, observable } from "mobx";
import { observer } from "mobx-react-lite";
import { Ship, ShipPosition } from "../ship/ship.js";
import { Grid } from "../grid/grid.js";

type mouseDownHandler = (event: React.MouseEvent<HTMLDivElement>) => void;
type mouseDownHandlerFactory = (ship: Ship) => mouseDownHandler;

export class ShipGrid {
    ships: Map<Ship, ShipPosition> = new Map(); 
    readonly grid: Grid;
    constructor({rows, cols}: {rows: number; cols: number}) {
        this.grid = new Grid(rows, cols);
        makeObservable(this, {
            ships: observable.shallow,
        });
    }


    public readonly Renderer = observer(({mouseDownHandlerFactory}: {mouseDownHandlerFactory: mouseDownHandlerFactory}) => {
       
        return (
            <section className="ship-grid">
                <this.grid.Renderer />
                {Array.from(this.ships.entries()).map(([ship, position]) => (
                    <ship.Renderer position={position} onMouseDown={mouseDownHandlerFactory(ship)} />
                ))} 
            </section>
        );
    });
}