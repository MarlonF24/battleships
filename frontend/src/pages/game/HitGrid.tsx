import { useCallback } from "react";
import { observer } from "mobx-react-lite";
import { create } from "@bufbuild/protobuf";
import { socketModels, StyledGrid, useWebSocketStore } from "../../base";
import GameWebsocketStore, { TurnStatus } from "./GameWebsocket";

import styled from "styled-components";

export type HitStateType = socketModels.ShipGridView_HitState;
export const HitState = socketModels.ShipGridView_HitState;


const StyledHitGrid = styled(StyledGrid).attrs({className: "hit-grid"})({
    "td > *": {
        position: "relative",
        zIndex: 100,
        
        /* This forces the SVG to respect the parent's size */
        display: "block", 
        width: "100%",
        height: "100%",
        
        /* This keeps the internal SVG graphics centered and scaled */
        maxWidth: "var(--cell-size)",
        maxHeight: "var(--cell-size)",
    }
})


export const HitGrid =  observer(({grid, shootable}: {grid: HitStateType[][], shootable: boolean}) => {
    
    const WSStore = useWebSocketStore(GameWebsocketStore);

    const sendShotMessage = useCallback((row: number, column: number) => {
        
        const shotMessage = create(socketModels.GamePlayerShotMessageSchema, {row, column});

        console.log(`Shot detected at ${row}, ${column}. Sending shot message:`, shotMessage, "Toggling turn in frontend");
        
        WSStore.hasTurn = TurnStatus.WAITING; 
        
        WSStore.sendGamePlayerMessage({case: "shot", value: shotMessage});
    }, []);
    
    return (
            <StyledHitGrid inert={WSStore.hasTurn !== TurnStatus.YOUR_TURN}>
                <tbody>
                    {grid.map((row, r) => (
                        <tr key={r}>
                            {row.map((cell, c) => (
                                <td key={`${r}-${c}`} className="cell" onClick={shootable && cell === HitState.UNTOUCHED ? () => sendShotMessage(r, c) : undefined} style={shootable && cell === HitState.UNTOUCHED ? {cursor:"pointer"} : undefined}>
                                    <HitGridCellContent hitState={cell} />
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </StyledHitGrid>
        );
    }
);

export default HitGrid;


const HitGridCellContent = ({hitState}: {hitState: HitStateType}) => {
    switch (hitState) {
        case HitState.HIT:
            return <HitCross />;
        case HitState.MISS:
            return <MissDot />;
        case HitState.IMPOSSIBLE:
            return <ImpossibleDot />;
        default:
            return null;
    }
};

const HitCross = () => (
    <svg className="red-X" viewBox={`0 0 24 24`}>
        <line x1="0" y1="0" x2={24} y2={24} stroke="red" strokeWidth={24 / 12} />
        <line x1={24} y1="0" x2="0" y2={24} stroke="red" strokeWidth={24 / 12} />
    </svg>
);

const Dot = ({opacity}: {opacity: number}) => (
    <svg className="miss-dot" viewBox={`0 0 24 24`} style={{opacity}}>
        <circle cx={12} cy={12} r={3} fill="blue" />
    </svg>
);

const MissDot = () => <Dot opacity={0.9} />;
const ImpossibleDot = () => <Dot opacity={0.4} />;