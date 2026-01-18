import { makeObservable, observable } from "mobx";
import { Ship, socketModels, ShipPosition } from "../../base";

class ActiveShipLogic extends Ship  {
    readonly headRow: number;
    readonly headCol: number;
    
    constructor(length: number, orientation: socketModels.Orientation, position: ShipPosition, public hits: boolean[] = []) {
        super(length, orientation);
        this.headRow = position.headRow;
        this.headCol = position.headCol;

        makeObservable(this, {
            hits: observable,
            hit: true,
            isSunk: true
        });
    }

    static fromSocketModel(model: socketModels.ActiveShip): ActiveShipLogic {
        return new this(
            model.length,
            model.orientation,
            {headRow: model.headRow, headCol: model.headCol},
            model.hits
        );
    }



    get isSunk(): boolean {
        return this.hits.filter(hit => hit).length >= this.length;
    }

    hit(idx: number): void {
        if (this.isSunk) {
            throw new Error("Ship is already sunk.");
        }
        if (this.hits[idx]) {
            throw new Error(`Position ${idx} of ship is already hit.`);
        }
        
        this.hits[idx] = true;
    }
}

export default ActiveShipLogic;