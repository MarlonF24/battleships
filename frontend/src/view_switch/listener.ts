import { pregameView } from "../pregame/view.js";
import { welcomeView } from "../welcome/view.js";
import { gameView } from "../game/view.js";
import { AppPhase, ViewSwitchEvent } from "./types.js";


function viewSwitchHandler(event: Event) {
    const { newPhase: phase, gameID } = (event as ViewSwitchEvent).detail;
    
    
    const mainContainer = document.getElementById("main-container")!;

    Array.from(mainContainer.getElementsByClassName("view")).forEach(view => view.remove()); // Clear existing view

    let view: HTMLDivElement;

    switch (phase) {
        case AppPhase.WELCOME:
            view = welcomeView();
            break;
        case AppPhase.PREGAME:
            view = pregameView(); // TODO: make pregameView gameID dependent 
            break;
        case AppPhase.GAME:
            view = gameView(gameID!);
            break;
        default:
            throw new Error(`Unknown app phase: ${phase}`);
    }

    view.classList.add("view")

    mainContainer.appendChild(view);
}

export function setUpViewSwitchingListener() {
    window.addEventListener("view-switch", viewSwitchHandler);
}