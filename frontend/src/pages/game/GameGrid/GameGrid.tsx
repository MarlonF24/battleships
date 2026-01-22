import { makeObservable } from "mobx";
import { useEffect, useState } from "react";

import { ShipGrid, ShipPosition, socketModels, useWebSocketStore } from "../../../base";
import HitGrid, {HitState, HitStateType} from "../HitGrid.js";
import ActiveShipLogic from "../ActiveShipLogic.js";
import FleetDisplay from "../FleetDisplay.js";

import GameWebsocketStore, { TurnStatus } from "../GameWebsocket.js";
import { Constructor } from "protobufjs";


import styled from "styled-components";

export type ShipLengthsType = Map<number, number> | {[length: number]: number};

class GameGrid {
    protected readonly shipGrid: ShipGrid<ActiveShipLogic>;
    protected readonly fleetDisplay: FleetDisplay;

    constructor(
        size: {rows: number; cols: number}, 
        shipLengths: ShipLengthsType, 
        activeShips: ActiveShipLogic[], 
        protected readonly hitGrid: HitStateType[][]) {
        const shipPositions = new Map(activeShips.map(ship => [ship, {headRow: ship.headRow, headCol: ship.headCol} as ShipPosition]));
        
        this.shipGrid = new ShipGrid(size, shipPositions);

        this.hitGrid = hitGrid;
        
        let shipLengthsMap: Map<number, number>;
        if (shipLengths instanceof Map) {
            shipLengthsMap = shipLengths;
        } else {
            shipLengthsMap = new Map(Object.entries(shipLengths).map(([lengthStr, count]) => [parseInt(lengthStr), count]));
        }


        this.fleetDisplay = new FleetDisplay(
            shipLengthsMap,
            activeShips
        );

        makeObservable<GameGrid, "hitGrid">(this,{
            hitGrid: true,
            hit: true,
        });
    } 
    
    static fromSocketModel<T extends GameGrid>(this: Constructor<T>, size: {rows: number; cols: number}, shipLengths: ShipLengthsType, view: socketModels.ShipGridView): T {
        const activeShips = view.ships.map(ship => ActiveShipLogic.fromSocketModel(ship));
        
        const hitGrid = view.hitGrid.map(row => row.cells);

        return new this(
            size,
            shipLengths,
            activeShips,
            hitGrid
        );
    }


    get ships(): Map<ActiveShipLogic, ShipPosition> {
        return this.shipGrid.ships;
    }

    hit (row: number, col: number): void {
        if (this.hitGrid[row][col] !== HitState.UNTOUCHED) {
            throw new Error(`Position (${row}, ${col}) has already been hit.`);
        }

        
        const shipAtPosition = this.shipGrid.shipCells[row][col];
        
        if (shipAtPosition) {
            this.hitGrid[row][col] = HitState.HIT;
            
            const shipIdx = shipAtPosition.orientation === socketModels.Orientation.HORIZONTAL ? col - shipAtPosition.headCol : row - shipAtPosition.headRow;
            shipAtPosition.hit(shipIdx);
           
        } else {
            this.hitGrid[row][col] = HitState.MISS;
        }
    }

   
    protected static StyledGameGrid = styled.section.attrs({className: "game-grid"})({
        display: "grid",
        gridTemplateColumns: "auto minmax(0, 1fr) auto",
        alignItems: "start",
        columnGap: "0.5rem", /* Add a small gap between fleet and grid */


        ".fleet-display:first-child": {
            gridColumn: 1,
            justifySelf: "start",
        },

        ".fleet-display:last-child": {
            gridColumn: 3,
            justifySelf: "end",
        },

        ".ship-grid": {
            gridColumn: 2,
            justifySelf: "center",
        }
    });


    readonly Renderer = ({fleetPosition, opponent}: {fleetPosition: "left" | "right", opponent: boolean} ) => {
        const WS = useWebSocketStore(GameWebsocketStore);
        const [opacity, setOpacity] = useState(0.6);

        useEffect(() => {
            if (opponent && WS.hasTurn === TurnStatus.YOUR_TURN
                || !opponent && WS.hasTurn === TurnStatus.OPPONENT_TURN
            ) {
                setOpacity(1);
            } else if (!opponent && WS.hasTurn === TurnStatus.YOUR_TURN
                || opponent && WS.hasTurn === TurnStatus.OPPONENT_TURN
            ) {
                setOpacity(0.6);
            }
        }, [WS.hasTurn, opponent]);

        return (
            <GameGrid.StyledGameGrid>
                {fleetPosition === "left" && <this.fleetDisplay.Renderer />}
                
                <div style={{opacity}}>
                    <this.shipGrid.Renderer>
                        <HitGrid grid={this.hitGrid} shootable={opponent} />
                    </this.shipGrid.Renderer>
                </div>

                {fleetPosition === "right" && <this.fleetDisplay.Renderer />}
            </GameGrid.StyledGameGrid>
        );
    }

}

export default GameGrid;