import React from "react";

import { useApi } from "../../utility/component";
import { useSwitchView, AppPhase } from "../../routing/switch_view";
import { api, ResponseError, unpackErrorMessage } from "../../backend_api";


import "./buttons.css";

export const CreateGameButton: React.FC = () => {
    const {error, executeApi} = useApi();
    const switchView = useSwitchView();

    const clickHandler = () => executeApi(async () => {
        const playerId = localStorage.getItem("playerId")!;

        // TODO: Allow user to customize these settings before creating the game in some form where this is the submit button and have validation 
        const battleGridRows: number = 10;
        const battleGridCols: number = 10;
        const shipLengths = [5, 4, 3, 3, 2];

        const gameId = await api.createGameGamesCreatePost({
            playerId,
            gameParams: { battleGridRows, battleGridCols, shipLengths }
        });

        console.log(`Game created with ID: ${gameId}`);
        switchView(AppPhase.PREGAME, gameId);
            
    })
    
    return (
        <>
            <button onClick={clickHandler} id="createGameButton">Create Game</button>
            {/* {loading && <span className="loading-indicator">Creating game...</span>} */}
            {error && <span className="error-message">Error: {error}</span>}
        </>
    )
}

