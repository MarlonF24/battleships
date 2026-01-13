import { observer } from "mobx-react-lite";
import ActiveShip from "../ActiveShip.js";
import { makeObservable, observable } from "mobx";



class FleetDisplay  {
    readonly shipDF: (ActiveShip | null)[][];
    private readonly lengthToRow: Map<number, number[]>
    static readonly MAX_ROW_LENGTH = 8;

    constructor(readonly shipLengths: Map<number, number>, activeShips: ActiveShip[]) {
        const [lengthToRow, shipDF] = this.buildEmptyDF();

        this.lengthToRow = lengthToRow;
        this.shipDF = shipDF;

        for (const ship of activeShips) {
            this.addActiveShip(ship);
        }

        makeObservable(this, {
            shipDF: observable.shallow
        });
    }


    buildEmptyDF(): [Map<number, number[]>, (ActiveShip | null)[][]] {
        const lengthToRow = new Map<number, number[]>();
        const shipDF: (ActiveShip | null)[][] = [];
        
        for (const [length, count] of this.shipLengths.entries()) {
            var row = []; 
            for (let i = 0; i < count; i++) {
                if (FleetDisplay.rowLength(row.length, length, true) > FleetDisplay.MAX_ROW_LENGTH || i === count - 1) {
                    
                    if (!lengthToRow.has(length)) {
                        lengthToRow.set(length, []);
                    }

                    lengthToRow.get(length)!.push(shipDF.length)
                    
                    shipDF.push(row)
                    row = []     
                }

                row.push(null)
            }
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
                            <>
                                <this.FleetBlock key={`fleet-block-${length}`} shipLength={length}/>
                                {index < array.length - 1 && <tr className="spacer"/>}
                            </>
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
                                <>
                                    <this.FleetShip key={`fleet-ship-${rowIdx}-${index}`} ship={ship} fallBackLength={shipLength}/>
                                    {index < array.length - 1 && <td className="spacer"/>}
                                </>
                            )
                        })}
                    
                    </tr>
                ))}
            </>
        )
    })

    readonly FleetShip = observer(({ship, fallBackLength}: {ship: ActiveShip | null, fallBackLength: number}) => {
        return (
            <>
                {Array.from({length: ship ? ship.length : fallBackLength}).map((_, index) => {
                    return (
                        <td className={`ship-cell ${ship ? ship.hits[index] ? "hit" : "" : ""}`}/>
                    )
                } )}       
            </>
        )
    })
}

export default FleetDisplay;