import { Button } from "../../utility/component";
import { switchToView, AppPhase } from "../../switch_view";
import { api, ResponseError } from "../../backend_api";


import "./buttons.css";

export class CreateGameButton extends Button {
    
    constructor() {
        super("Create Game");
    }

    async clickHandler(e: MouseEvent): Promise<void> {
        const playerId = localStorage.getItem("playerId")!;

        // TODO: Allow user to customize these settings before creating the game in some form where this is the submit button and have validation 
        const battleGridRows: number = 10;
        const battleGridCols: number = 10;
        const shipLengths = [5, 4, 3, 3, 2];


        try {
            const gameId = await api.createGameCreateGamePost({
                playerId,
                gameParams: { battleGridRows, battleGridCols, shipLengths }
            });

            console.log(`Game created with ID: ${gameId}`);
            switchToView(AppPhase.PREGAME, gameId);
            
        } catch (error) {
            if (error instanceof ResponseError) {
                console.error(`Failed to create game: ${error.response.status} - ${error.response.statusText}`);
                alert(`Failed to create game: ${error.response.status} - ${error.response.statusText}`);
            }
        }
    }
}

