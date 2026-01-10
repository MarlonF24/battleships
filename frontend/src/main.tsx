import { createRoot } from "react-dom/client";
import { configure } from "mobx";

configure({
    enforceActions: "observed" 
});

import { api, unpackErrorMessage } from "./base/backend_api.js";


import "./main.css";
import { ResponseError } from "./api-client/index.js";
import App from "./App.js";


createPlayer();

async function createPlayer() {
  let playerId = sessionStorage.getItem("playerId");

  try {
    let responsePlayerId = await api.createPlayerPlayersCreatePost(playerId ? {playerId: playerId} : undefined);
    sessionStorage.setItem("playerId", responsePlayerId);
    console.log(`Player in the DB with ID: ${responsePlayerId}`);

  } catch (error) {
    if (error instanceof ResponseError) {
      const message = await unpackErrorMessage(error);

      if (error.response.status === 500 && message.toLocaleLowerCase().includes("player")) {
        alert("Error creating player. The page will reload to try again.");
        window.location.reload();
        
        console.error("Error creating player:", error);
        return;
      }
    }
    console.error("Error creating player:", error);
    throw error;
  }
}


createRoot(document.getElementById('root')!).render(
    <App />
);