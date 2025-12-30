import { Component } from "../../utility/component";
import { switchToView, AppPhase } from "../../view_switch/types";

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

        form.addEventListener("submit", this.dispatchJoin);

        const input = document.createElement("input");
        input.type = "text";
        input.id = "game-id-input";
        input.name = "gameId";
        input.placeholder = "Enter Game ID";
        input.addEventListener("input", this.resetError);


        const label = document.createElement("label");
        label.htmlFor = "game-id-input";
        label.innerText = "Join an existing game:";

        const submitButton = document.createElement("button");
        submitButton.type = "button";
        submitButton.className = "join-game-btn";
        submitButton.textContent = "Join Game";

        submitButton.addEventListener("click", () => {
            this.dispatchJoin(new Event("submit", { bubbles: true, cancelable: true }));
        });

    
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

    dispatchJoin = async (event: Event) => {
        event.preventDefault();
        const formData = new FormData(this.html);
        const gameId = formData.get("gameId");

        if (typeof gameId === "string" && gameId.trim() !== "") {
            console.log("Attempting to join game with ID:", gameId);


            const playerId = localStorage.getItem("playerId")!;

            let response = await fetch(`${window.BACKEND_HTTP_ADDRESS}/${gameId}/join?playerId=${playerId}`, {method: "POST",});

            if (!response.ok) {
                if (response.status === 404) {
                    const error = await response.json();
                    const detail = error.detail as string;

                    if (detail.includes("Game not found")) {
                        this.displayError("Game not found. Please type in a valid Game ID and try again.");
                        
                    } else {
                        alert("An unexpected error occurred. Page will reload.");
                        window.location.reload();
                    }
                } else if (response.status === 422) {
                    this.displayError("Please enter a valid Game ID.");
                }
            } else {
                const data = await response.json();
                const joinedGameId = data.id;
                switchToView(AppPhase.PREGAME, joinedGameId, true);
                console.log(`Successfully joined game with ID: ${joinedGameId}`);
            }
        }
    }

    

}
