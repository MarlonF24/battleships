import { observer } from "mobx-react-lite";

import { useWebSocketStore } from "../context"; 



export const OpponentConnection: React.FC = observer(() => {
    const webSocketStore = useWebSocketStore();
    const { opponentConnected, initiallyConnected } = webSocketStore.opponentConnection;

    let statusMessage = "Waiting for opponent to connect...";
    if (opponentConnected) {
        statusMessage = "Opponent connected";
    } else if (initiallyConnected) {
        statusMessage = "Opponent disconnected";
    }

    return (
        <div style={{ fontStyle: "italic", color: "var(--secondary-text-color)" }}>
            {statusMessage}
        </div>
    );
})