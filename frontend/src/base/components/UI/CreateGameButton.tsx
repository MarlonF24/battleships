import React from "react";
import { useApi } from "../../hooks";
import { api } from "../../api";
import { ErrorMessage } from "./ErrorMessage.tsx";
import { useSwitchView, Page } from "../../../routing/switch_view";
import { Button } from "./Button.tsx";



export const CreateGameButton: React.FC = () => {
    const {loading, error, executeApi} = useApi();
    const switchView = useSwitchView();

    const clickHandler = () => executeApi(async () => {
        const playerId = sessionStorage.getItem("playerId")!;

        // TODO: Allow user to customize these settings before creating the game in some form where this is the submit button and have validation 
        const battleGridRows: number = 10;
        const battleGridCols: number = 10;
        const shipLengths: Map<number, number> = new Map([[5, 1], [4, 2], [3, 3], [2, 4]]); // length -> count

        const gameId = await api.createGameGamesCreatePost({
            playerId,
            pregameParams: { battleGridRows, battleGridCols, shipLengths: Object.fromEntries(shipLengths) }
        });

        console.log(`Game created with ID: ${gameId}`);
        switchView(Page.PREGAME, gameId);
            
    })
    
    return (
        <>
            <Button $type="primary" onClick={clickHandler} disabled={loading}>
                {loading ? "Creating..." : "Create Game"}
            </Button>
            {error && <ErrorMessage errorMessage={`Error: ${error}`} />}
        </>
    )
}


