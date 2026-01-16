import { useCallback } from "react";
import { observer } from "mobx-react-lite";
import sendGamePlayerMessage from "../sendGamePlayerMessage";
import { create } from "@bufbuild/protobuf";
import { socketModels } from "../../../base/api";
import { useWebSocketStore } from "../../../base";
import GameWebsocketStore from "../GameWebsocket";

export const HitGrid =  observer(({grid, shootable}: {grid: boolean[][], shootable: boolean}) => {
    
    const WSStore = useWebSocketStore(GameWebsocketStore);

    const sendShotMessage = useCallback((row: number, column: number) => {
        
        const shotMessage = create(socketModels.GamePlayerShotMessageSchema, {row, column});

        console.log(`Shot detected at ${row}, ${column}. Sending shot message:`, shotMessage);
        
        sendGamePlayerMessage({case: "shot", value: shotMessage});
    }, []);
    
    return (
            <table className="hit-grid grid" inert={!WSStore.hasTurn}>
                <tbody>
                    {grid.map((row, r) => (
                        <tr key={r}>
                            {row.map((cell, c) => (
                                <td key={`${r}-${c}`} className="cell" onClick={shootable && !cell ? () => sendShotMessage(r, c) : undefined} >
                                    {cell && <HitCross />}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        );
    }
);

export default HitGrid;

const HitCross = () => (
    <svg className="red-X" viewBox={`0 0 24 24`}>
        <line x1="0" y1="0" x2={24} y2={24} stroke="red" strokeWidth={24 / 12} />
        <line x1={24} y1="0" x2="0" y2={24} stroke="red" strokeWidth={24 / 12} />
    </svg>
);