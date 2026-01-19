import React from "react";
import { observer } from "mobx-react-lite";
import ActiveShip from "../ActiveShipLogic.js";
import { makeObservable, observable } from "mobx";

import "./FleetDisplay.css";

class FleetDisplay  {
    readonly shipDF: (ActiveShip | null)[][];
    private readonly lengthToRow: Map<number, number[]>
    static readonly MAX_ROW_LENGTH = 15;

    constructor(readonly shipLengths: Map<number, number>, activeShips: ActiveShip[]) {
        const [lengthToRow, shipDF] = this.buildEmptyDF();

        this.lengthToRow = lengthToRow;
        this.shipDF = shipDF;

        for (const ship of activeShips) {
            this.addActiveShip(ship);
        }

        makeObservable(this, {
            shipDF: observable,
            addActiveShip: true,
        });
    }


    buildEmptyDF(): [Map<number, number[]>, (ActiveShip | null)[][]] {
        const lengthToRow = new Map<number, number[]>();
        const shipDF: (ActiveShip | null)[][] = [];

        const pushRow = (row: (ActiveShip | null)[], length: number) => {
            if (!lengthToRow.has(length)) {
                lengthToRow.set(length, []);
            }

            lengthToRow.get(length)!.push(shipDF.length)
                    
            shipDF.push(row)
        }
        
        for (const [length, count] of this.shipLengths.entries()) {
            var row = []; 
            for (let i = 0; i < count; i++) {
                if (FleetDisplay.rowLength(row.length, length, true) > FleetDisplay.MAX_ROW_LENGTH) {
                    pushRow(row, length);
                    row = []     
                }

                row.push(null)
            }

            if (row.length > 0) pushRow(row, length);
        }
        return [lengthToRow, shipDF];
    
    }

    

    static rowLength(numSpots: number, shipLength: number, accountForAdditional: boolean) {
        return (numSpots + (accountForAdditional ? 1 : 0)) * (shipLength + 1) - 1 
    }

    addActiveShip(ship: ActiveShip): void {
        if (!this.lengthToRow.has(ship.length)) throw new Error("Tried to add ship to fleet display with unseen length");
        
        for (const rowIdx of this.lengthToRow.get(ship.length)!) {
            const firstNullIdx = this.shipDF[rowIdx].findIndex(spot => spot === null) 

            if (firstNullIdx === -1) continue;

            this.shipDF[rowIdx][firstNullIdx] = ship;
            return;
        }

        throw new Error("Tried to add ship to fleet display but no space available. This should be impossible.");
    }

    readonly Renderer: React.FC = observer(() => {
        return (
            <table className="fleet-display">
                <tbody>
                    {Array.from(this.lengthToRow.keys()).sort((a, b) => b - a).map((length, index, array) => { // Sort lengths descending
                        return (
                            <React.Fragment key={`fleet-group-${length}`}>
                                <this.FleetBlock shipLength={length}/>
                                {index < array.length - 1 && <tr className="spacer"/>}
                            </React.Fragment>
                        )
                    })}
                </tbody>
            </table>)
        })
        

    readonly FleetBlock = observer(({shipLength}: {shipLength: number}) => {
        return (
            <>
                {this.lengthToRow.get(shipLength)!.map(rowIdx => (
                    <tr key={`fleet-display-row${rowIdx}-length${shipLength}`}>
                        {this.shipDF[rowIdx].map((ship, index, array) => {
                            return (
                                <React.Fragment key={`ship-fragment-${rowIdx}-${index}`}>
                                    <this.FleetShip 
                                        ship={ship} 
                                        fallBackLength={shipLength} 
                                        rowIdx={rowIdx} 
                                    />
                                    {index < array.length - 1 && <td className="spacer"/>}
                                </React.Fragment>
                            )
                        })}
                    
                    </tr>
                ))}
            </>
        )
    })

    readonly FleetShip = observer(({ship, fallBackLength, rowIdx}: {ship: ActiveShip | null, fallBackLength: number, rowIdx: number}) => {
        return (
            <>
                {Array.from({length: ship ? ship.length : fallBackLength}).map((_,index) => {
                    return (
                        <td key={`ship-cell-${rowIdx}-${index}`} className={`ship-cell ${ship ? ship.hits[index] ? "hit" : "" : ""}`}/>
                    )
                } )}       
            </>
        )
    })
}

export default FleetDisplay;