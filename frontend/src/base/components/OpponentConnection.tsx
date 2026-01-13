import { useEffect, useState } from "react";
import { apiModels, BackendWebSocket } from "../backend_api";

export const OpponentConnection: React.FC = () => {
    const [connectionInfo, setConnectionInfo] = useState<apiModels.WSServerOpponentConnectionMessage>({opponentConnected: false, initiallyConnected: false});

    useEffect(() => {
        BackendWebSocket.registerMessageHandler((message: MessageEvent) => {
            if (apiModels.instanceOfWSServerOpponentConnectionMessage(message)) {
                console.log(`Opponent connection status changed: connected=${message.opponentConnected}`);
                setConnectionInfo(message);
            }});
    }, [])

    return (
        <span style={{ fontStyle: "italic", color: "var(--secondary-text-color)" }}>
            {connectionInfo.opponentConnected ? "Opponent connected" : connectionInfo.initiallyConnected ? "Opponent disconnected" : "Waiting for opponent to connect..."}
        </span>
    );
}