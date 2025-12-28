import { switchToView } from "../view_switch/types";
import { CreateGameButton } from "./buttons";


export function welcomeView() {
    
    const container = document.createElement("div");
    
    const welcomeSection = document.createElement("section");
    welcomeSection.id = "welcome-section";
    welcomeSection.classList.add("welcome-section");

    const createGameButton = new CreateGameButton(window.location.origin);
    return container;    
}