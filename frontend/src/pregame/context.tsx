import React, { createContext, ReactNode, useCallback, useContext, useState } from "react";
import { useEffect } from "react";
import { BackendWebSocket } from "../backend_api.js";
import { useSwitchView, AppPhase } from "../routing/switch_view.js";

interface ReadyContextType {
    numReadyPlayers: number;
    pregameWS: WebSocket;
}

const ReadyContext = createContext<ReadyContextType>(null!);

export interface PregameWSPlayerReadyMessage {
  shipPositions: {[key: number]: [number, number]}; // ship length -> [row, col] positions
}

interface PregameWSServerMessage {
  num_players_ready: number;
  self_ready: boolean;
}

export const ReadyContextProvider: React.FC<{ gameId: string, children: ReactNode }> = ({ gameId, children }) => {
  const [numReadyPlayers, setNumReadyPlayers] = useState(0);
  const [allowPointerEvents, setAllowPointerEvents] = useState(false); // Initially disable pointer events until we know the player's ready status (due to a reload of the page we might be ready already)

  useEffect(() => {
		const playerId = localStorage.getItem("playerId")!;
		const ws = BackendWebSocket.connect(AppPhase.PREGAME, gameId, playerId);

    ws.onopen = () => {
    console.log("WebSocket connection established");
    };
    
    ws.onmessage = pregameWSHandler;

		ws.onerror = (error) => {
		console.error("WebSocket error:", error);
		};

		ws.onclose = () => {
		console.log("WebSocket connection closed");
		};

		return () => BackendWebSocket.disconnect();

 	}, [gameId]);
   
  const pregameWSHandler = useCallback((event: MessageEvent) => {
    const message: PregameWSServerMessage = JSON.parse(event.data);
    
    console.log(`Players ready: ${message.num_players_ready}/2`);
    
    setNumReadyPlayers(message.num_players_ready);
    
    if (!message.self_ready) { // catch the first backend message after connecting
      setAllowPointerEvents(true); 
    } else {
      console.log("You are marked as ready.");
      setAllowPointerEvents(false); // Disable pointer events
    }

    if (message.num_players_ready === 2) {
      console.log("Both players ready! Starting game...");
      // useSwitchView()(AppPhase.GAME, gameId);
    }			
  }, []);


  return (
    <ReadyContext.Provider value={{ numReadyPlayers, pregameWS: BackendWebSocket.socket }}>
      <div style={allowPointerEvents ? {} : { pointerEvents: 'none' }}>
        {children}
      </div>
    </ReadyContext.Provider>
  );
};


export const useReadyContext = (): ReadyContextType => {
  const context = useContext(ReadyContext);
  if (!context) throw new Error('useReadyContext must be used within ReadyContextProvider');
  return context;
};