import Navigo from "navigo";
import { Match } from "navigo";
import { AppPhase, ViewSwitchEvent } from "../switch_view.js";
import { pregameView } from "../pregame/view.js";
import { welcomeView } from "../welcome/view.js";
import { gameView } from "../game/view.js";
import { api, ResponseError, BackendWebSocket, unpackErrorMessage } from "../backend_api.js";


function insertView(view: HTMLDivElement) {
    view.classList.add("view");
    const mainContainer = document.getElementById("main-container")!;
    Array.from(mainContainer.getElementsByClassName("view")).forEach(view => view.remove()); // Clear existing view
    mainContainer.appendChild(view);
}

interface PregameWSServerMessage {
    num_players_ready: number;
}

export function setUpRouter() {
    new Router();
}

class Router extends Navigo {
    private gameId: string | null = null;

    constructor() {
        super("/", { hash: false });
        
        
        this.on("/", () => {
            this.navigate("/welcome");
        });
        
        this.on("/welcome", () => {
            insertView(welcomeView());
            }
        );
        
        this.on("/games/:gameId/pregame", this.navigatePregame);

        this.on("/games/:gameId/game", this.navigateGame);

        window.addEventListener("view-switch", this.viewSwitchHandler);
        this.resolve();
    }




    navigate(path: string): void {
        super.navigate(path);
        console.log(`Navigated to ${path}`);
    }
    
    
    viewSwitchHandler = (event: Event) => {
        const { newPhase: phase, gameId } = (event as ViewSwitchEvent).detail;
        
        switch (phase) {
            case AppPhase.WELCOME:
                this.navigate("/welcome");
                return;
                case AppPhase.PREGAME:
                    if (!gameId) {
                        throw new Error("Game ID is required for pregame view");
                    }
                    this.navigate(`/games/${gameId}/pregame`);
                    return;
                    case AppPhase.GAME:
                        if (!gameId) {
                            throw new Error("Game ID is required for game view");
                        }
                        this.navigate(`/games/${gameId}/game`);
                        return;
                        default: {
                throw new Error(`Unknown AppPhase: ${phase}`);
            }
        }
        
    }
    
    pregameWSHandler = (event: MessageEvent) => {
        const message: PregameWSServerMessage = JSON.parse(event.data);
        
        console.log(`Players ready: ${message.num_players_ready}/2`);
        
        const readyPlayerCountSpan = document.getElementsByClassName("ready-players-count")[0] as HTMLSpanElement;
        
        readyPlayerCountSpan.textContent = `(${message.num_players_ready}/2)`;
    
    
        if (message.num_players_ready === 2) {
            console.log("Both players ready! Starting game...");
            // BackendWebSocket.disconnect();
            // dispatchEvent(new ViewSwitchEvent(AppPhase.GAME, this.gameId!));
        }
    }

    navigatePregame = async (match: Match | undefined) => {
        const gameId = match!.data!.gameId;
        const playerId = localStorage.getItem("playerId")!
        
        try {
            const gameParams = await api.getPregameParamsGamesGamesGameIdParamsGet({gameId, playerId});
            insertView(pregameView(gameId, gameParams));
            console.log("Navigated to pregame view");
            
            BackendWebSocket.connect(`ws://${window.BACKEND_ORIGIN}/games/ws/${gameId}/pregame?playerId=${playerId}`);
            
            BackendWebSocket.socket.onmessage = this.pregameWSHandler;

            this.gameId = gameId;
            
        } catch (error) {
            if (error instanceof ResponseError) {
                const message = await unpackErrorMessage(error);
                switch (error.response.status) {
                    case 404:   
                    case 403:   
                    case 422:
                        alert(`${message} Redirecting to welcome page.`);
                        this.navigate("/welcome");
                        return;
                    default: 
                        alert(`Unexpected error: ${message} Page will reload.`);
                        window.location.reload();
                        return;
                }
            } 
        }
    } 

    navigateGame = (match: Match | undefined) => {
        const gameId = match!.data!.gameId;
        const playerId = localStorage.getItem("playerId")!
        //DB query to verify player is part of game could be added here and get board
        insertView(gameView(gameId));
        console.log("Navigated to game view");
    }
}

