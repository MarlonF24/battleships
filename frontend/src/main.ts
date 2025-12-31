import { switchToView, AppPhase } from "./switch_view.js";
import { setUpRouter } from "./routing/router.js";
import { api } from "./backend_api.js";



import "./main.css";
import { ResponseError } from "./api-client/index.js";

setUpRouter();

createPlayer();

async function createPlayer() {
  let playerId = localStorage.getItem("playerId");

  try {
    let player = await api.createPlayerCreatePlayerPost(playerId ? {playerId: playerId} : undefined);
    localStorage.setItem("playerId", player.id!);
    console.log(`Player in the DB with ID: ${player.id}`);

  } catch (error) {
    if (error instanceof ResponseError) {
      
      if (error.response.status === 500 && error.message.toLocaleLowerCase().includes("player")) {
        alert("Internal server error. Page will reload.");
        window.location.reload();
        
        console.error("Error creating player:", error);
        return;
      }
    }
    console.error("Error creating player:", error);
    throw error;
  }
}