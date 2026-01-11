import { apiModels } from "../backend_api";

export const OpponentConnection: React.FC<{ connectionInfo: apiModels.WSServerOpponentConnectionMessage }> = ({ connectionInfo }) => {
    return (
        <span style={{ fontStyle: "italic", color: "var(--secondary-text-color)" }}>
            {connectionInfo.opponentConnected ? "Opponent connected" : connectionInfo.initiallyConnected ? "Opponent disconnected" : "Waiting for opponent to connect..."}
        </span>
    );
}