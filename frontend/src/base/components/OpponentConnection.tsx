import { useEffect, useState } from "react";
import { create } from "@bufbuild/protobuf";
import { BackendWebSocket, socketModels, sendGeneralPlayerMessage } from "../backend_api";


export const OpponentConnection: React.FC = () => {
    const [connectionInfo, setConnectionInfo] = useState(create(socketModels.ServerOpponentConnectionMessageSchema, {opponentConnected: false, initiallyConnected: false}));



    useEffect(() => {
        BackendWebSocket.createMessageHandler((message: socketModels.ServerMessage) => {
            if (message.payload.case === "generalMessage") {
                let innerPayload = message.payload.value;
                if (innerPayload.payload.case === "opponentConnectionMessage") {
                    let connMessage = innerPayload.payload.value;
                    console.log(`Opponent connection status changed: connected=${connMessage.opponentConnected}`);
                    setConnectionInfo(connMessage);
                }
            }});
        
            sendGeneralPlayerMessage({
                case: "opponentConnectionListening", 
                value: create(socketModels.PlayerOpponentConnectionPollSchema)
            });
    }, [])

    return (
        <span style={{ fontStyle: "italic", color: "var(--secondary-text-color)" }}>
            {connectionInfo.opponentConnected ? "Opponent connected" : connectionInfo.initiallyConnected ? "Opponent disconnected" : "Waiting for opponent to connect..."}
        </span>
    );
}