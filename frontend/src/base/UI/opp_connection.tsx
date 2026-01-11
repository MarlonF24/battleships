import { useEffect, useRef } from "react";

export const OpponentConnection: React.FC<{ connected: boolean }> = ({ connected }) => {
    const initialConnection = useRef(false);
    
    useEffect(() => {
        if (connected) {
            initialConnection.current = true;
        }
    }, [connected]);

    return (
        <span style={{ fontStyle: "italic", color: "var(--secondary-text-color)" }}>
            {connected ? "Opponent connected" : initialConnection.current ? "Opponent disconnected" : "Waiting for opponent to connect..."}
        </span>
    );
}