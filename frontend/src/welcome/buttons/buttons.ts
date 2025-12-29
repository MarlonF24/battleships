import { Button } from "../../utility/component";
import { switchToView, AppPhase } from "../../view_switch/types";

import "./buttons.css";

export class CreateGameButton extends Button {
    
    constructor() {
        super("Create Game");
    }

    async clickHandler(e: MouseEvent): Promise<void> {
        const playerId = localStorage.getItem("playerId")!;
        const response = await fetch(`${window.BACKEND_HTTP_ADDRESS}/create-game?playerId=${playerId}`, { method: "POST" });
        const data = await response.json();
        const gameId = data.gameId;
        
        console.log(`Game created with ID: ${gameId}`);
        switchToView(AppPhase.PREGAME, gameId, true);
    }
}

