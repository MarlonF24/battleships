import { Component } from "../../utility/component";
import { switchToView, AppPhase } from "../../switch_view";
import { api, ResponseError, unpackErrorMessage } from "../../backend_api";

import "./inputs.css";

export class JoinGameInput extends Component {
    declare html: HTMLFormElement;
    private errorMsg!: HTMLDivElement;

    constructor() {
        super();
        this.update_html();
    }

    render(): HTMLFormElement {
        const form = document.createElement("form");
        form.id = "join-game-form";

        // Error message element
        const errorMsg = document.createElement("div");
        this.errorMsg = errorMsg;
        errorMsg.id = "join-game-error";
        errorMsg.className = "join-game-error";
        errorMsg.style.display = "none";

        form.onsubmit = this.dispatchJoin;

        const input = document.createElement("input");
        input.type = "text";
        input.id = "game-id-input";
        input.name = "gameId";
        input.placeholder = "Enter Game ID";
        input.oninput = this.resetError;


        const label = document.createElement("label");
        label.htmlFor = "game-id-input";
        label.innerText = "Join an existing game:";

        const submitButton = document.createElement("button");
        submitButton.type = "button";
        submitButton.className = "join-game-btn";
        submitButton.textContent = "Join Game";

        submitButton.onclick = this.dispatchJoin;

    
        form.appendChild(errorMsg);
        form.appendChild(label);
        form.appendChild(input);
        form.appendChild(submitButton);
        
        return form;
    }

    displayError = (message: string): void => {
        this.errorMsg.textContent = message;
        this.errorMsg.style.display = "block";
    }

    resetError = (): void => {
        this.errorMsg.textContent = "";
        this.errorMsg.style.display = "none";
        console.log("Error message cleared.");
    }

    dispatchJoin = async () => {
        
        const formData = new FormData(this.html);
        const gameId = formData.get("gameId");

        if (!gameId || typeof gameId !== "string" || gameId.trim() === "") {
            this.displayError("Invalid Game ID.");
            return;
        }
        
        
        console.log("Attempting to join game with ID:", gameId);

        const playerId = localStorage.getItem("playerId")!;

        try {
            await api.joinGameGamesGamesGameIdJoinPost({gameId, playerId});
            switchToView(AppPhase.PREGAME, gameId);
            console.log(`Successfully joined game with ID: ${gameId}`);

        } catch (error) {
            if (error instanceof ResponseError) {
                const message = await unpackErrorMessage(error);
    
                this.displayError(`Error: ${message}`);
                console.error("Error joining game:", message);
                
            }
        }

        
    }
}
