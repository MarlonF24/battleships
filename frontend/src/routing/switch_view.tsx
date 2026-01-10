import { useNavigate } from "react-router-dom";

export enum Page {
    WELCOME = "welcome",
    PREGAME = "pregame",
    GAME = "game",
    ERROR = "error",
    BACK = "back"
}

export function useSwitchView() {
    const navigate = useNavigate();

    return (page: Page, gameId?: string, message?: string) => {
        switch (page) {
            case Page.WELCOME:
                navigate("/welcome");
                break;
            case Page.PREGAME:
                if (!gameId) {
                    throw new Error("Game ID is required for pregame view");
                }
                navigate(`/games/${gameId}/pregame`);
                break;
            case Page.GAME:
                if (!gameId) {
                    throw new Error("Game ID is required for game view");
                }
                navigate(`/games/${gameId}/game`);
                break;
            case Page.ERROR:
                navigate("/error", { state: { message } });
                break;
            case Page.BACK:
                navigate(-1);
                break;
            default:
                throw new Error(`Unknown Page: ${page}`);
        }
    };
}

