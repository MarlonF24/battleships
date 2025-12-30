declare global {
  interface Window {
    BACKEND_ORIGIN: string;
    BACKEND_WS_ADDRESS: string;
    BACKEND_HTTP_ADDRESS: string;
  }
}


import { setUpViewSwitchingListener } from "./view_switch/listener.js";
import { switchToView, AppPhase } from "./view_switch/types.js";
import "./main.css";


function storeBackendAddresses() {
window.BACKEND_ORIGIN = import.meta.env.VITE_BACKEND_ORIGIN ?? window.location.origin;
window.BACKEND_HTTP_ADDRESS = "http://" + window.BACKEND_ORIGIN;
window.BACKEND_WS_ADDRESS = `ws://${window.BACKEND_ORIGIN}/ws`;
}

storeBackendAddresses();

setUpViewSwitchingListener();

switchToView(AppPhase.WELCOME);

createPlayer();

async function createPlayer() {
  let playerId = localStorage.getItem("playerId");
  let url = `${window.BACKEND_HTTP_ADDRESS}/create-player`;
  if (playerId) {
    url += `?playerId=${playerId}`;
  }
  const response = await fetch(url, { method: "POST" });

  if (!response.ok) {
    alert("An unexpected error occurred. Page will reload.");
    window.location.reload();
  }
  const data = await response.json();
  playerId = data.id;
  localStorage.setItem("playerId", playerId!);
  console.log(`Player in the DB with ID: ${playerId}`);
}