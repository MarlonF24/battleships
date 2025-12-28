import { Button } from "../utility/component";
import { switchToView } from "../view_switch/types";

export class CreateGameButton extends Button {
    
    constructor(readonly backendAddress: string) {
        super("Create Game", "create-game-button");
    }

    async clickHandler(e: MouseEvent): Promise<void> {
        const response = await fetch(`${this.backendAddress}/create-game`, { method: "POST" });
        const data = await response.json();
        const gameId = data.gameId;
        
        window.history.pushState({}, "", `/game.html?gameId=${gameId}`);
    }
}

