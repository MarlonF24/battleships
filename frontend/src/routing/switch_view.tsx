import { useNavigate } from "react-router-dom";

export enum AppPhase {
    WELCOME = "welcome",
    PREGAME = "pregame",
    GAME = "game",
}

export function useSwitchView() {
    const navigate = useNavigate();

    return (phase: AppPhase, gameId?: string) => {
        switch (phase) {
            case AppPhase.WELCOME:
                navigate("/welcome");
                break;
            case AppPhase.PREGAME:
                if (!gameId) {
                    throw new Error("Game ID is required for pregame view");
                }
                navigate(`/games/${gameId}/pregame`);
                break;
            case AppPhase.GAME:
                if (!gameId) {
                    throw new Error("Game ID is required for game view");
                }
                navigate(`/games/${gameId}/game`);
                break;
            default:
                throw new Error(`Unknown AppPhase: ${phase}`);
        }
    };
}

