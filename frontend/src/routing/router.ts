import Navigo from "navigo";
import { AppPhase, ViewSwitchEvent } from "../switch_view.js";
import { pregameView } from "../pregame/view.js";
import { welcomeView } from "../welcome/view.js";
import { gameView } from "../game/view.js";
import { api, ResponseError } from "../backend_api.js";

function insertView(view: HTMLDivElement) {
    view.classList.add("view");
    const mainContainer = document.getElementById("main-container")!;
    Array.from(mainContainer.getElementsByClassName("view")).forEach(view => view.remove()); // Clear existing view
    mainContainer.appendChild(view);
}


export function setUpRouter() {
    const router = new Navigo("/", { hash: false }); 

    function viewSwitchHandler(event: Event) {
        const { newPhase: phase, gameId } = (event as ViewSwitchEvent).detail;
        
        switch (phase) {
            case AppPhase.WELCOME:
                router.navigate("/welcome");
                return;
            case AppPhase.PREGAME:
                if (!gameId) {
                    throw new Error("Game ID is required for pregame view");
                }
                router.navigate(`/pregame?gameId=${gameId}`);
                return;
            case AppPhase.GAME:
                if (!gameId) {
                    throw new Error("Game ID is required for game view");
                }
                router.navigate(`/game?gameId=${gameId}`);
                return;
            default: {
                throw new Error(`Unknown AppPhase: ${phase}`);
            }
        }
            
    }
        
    router.on("/", () => {
        router.navigate("/welcome");
    });

    router.on("/welcome", () => {
        insertView(welcomeView());
        }
    );

    router.on("/pregame", async (match) => {
        const gameId = match!.params!.gameId;
        const playerId = localStorage.getItem("playerId")!
        
        try {
            const gameParams = await api.getGameParamsGamesGameIdParamsGet({gameId, playerId});
            insertView(pregameView(gameId, gameParams));
        } catch (error) {
        
        if (error instanceof ResponseError) {
            switch (error.response.status) {
                case 404: 
                    alert("Game not found. Redirecting to welcome page.");
                    router.navigate("/welcome");
                    return;
                case 403: 
                    alert("You are not a participant of this game. Redirecting to welcome page.");
                    router.navigate("/welcome");
                    return;
                case 422:
                    // wrong gameId or playerId format, but 
                    alert("An invalid ID format was provided. Redirecting to welcome page.");
                    router.navigate("/welcome");
                    return;
                default: 
                    alert("An unexpected error occurred. Page will reload.");
                    window.location.reload();
                    return;
                }
            } 
        }
    }
    );
    
    

        router.resolve();
    
        window.addEventListener("view-switch", viewSwitchHandler);
        
        return router;
    }