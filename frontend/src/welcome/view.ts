import { CreateGameButton } from "./buttons/buttons";
import { JoinGameInput } from "./inputs/inputs";

import "./welcome.css";

export function welcomeView() {
    const container = document.createElement("div");
    container.id = "welcome-container";
    container.classList.add("welcome-container");

    const welcomeSection = document.createElement("section");
    welcomeSection.id = "welcome-section";
    welcomeSection.classList.add("welcome-section");

    const heading = document.createElement("h2");
    heading.textContent = "Welcome to Battleships!";
    welcomeSection.appendChild(heading);

    // Create Game button
    const createGameButton = new CreateGameButton();
    welcomeSection.appendChild(createGameButton.html);

    // Join Game input
    const joinGameInput = new JoinGameInput();
    welcomeSection.appendChild(joinGameInput.html);

    container.appendChild(welcomeSection);
    return container;
}