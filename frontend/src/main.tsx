import { createRoot } from "react-dom/client";
import { configure } from "mobx";

import { getPlayerId, setPlayerId } from "./base";


configure({
    enforceActions: "observed" 
});

import { api, unpackErrorMessage, ResponseError } from "./base";


import "./main.css";
import App from "./App.js";




async function createPlayer() {
  let playerId = getPlayerId();

  try {
    let responsePlayerId = await api.createPlayerPlayersCreatePost(playerId ? {playerId: playerId} : undefined);
    setPlayerId(responsePlayerId);
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


await createPlayer();