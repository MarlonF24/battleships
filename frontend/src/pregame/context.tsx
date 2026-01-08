import React, { createContext, ReactNode, useCallback, useContext, useState } from "react";
import { useEffect } from "react";
import { BackendWebSocket } from "../base/backend_api.js";
import { useSwitchView, AppPhase } from "../routing/switch_view.js";

interface ReadyContextType {
    numReadyPlayers: number;
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
  const [inert, setInert] = useState(true);
  const [isConnected, setIsConnected] = useState(false);


  const pregameWSHandler = useCallback((event: MessageEvent) => {
    const message: PregameWSServerMessage = JSON.parse(event.data);
    
    console.log(`Received backend message. num_players_ready: ${message.num_players_ready}, self_ready: ${message.self_ready}`);
    
    setNumReadyPlayers(message.num_players_ready);
    
    if (!message.self_ready) { // catch the first backend message after connecting
      setInert(false); 
    } else {
      console.log("You are marked as ready.");
      setInert(true); 
    }

    if (message.num_players_ready === 2) {
      console.log("Both players ready! Starting game...");
      // useSwitchView()(AppPhase.GAME, gameId);
    }			
  }, []);

  useEffect(() => {
  
    setIsConnected(false);
    const ws = BackendWebSocket.connect(
      AppPhase.PREGAME,
      gameId,
      localStorage.getItem("playerId")!,
      pregameWSHandler,
      () => {setIsConnected(true); console.log("Pregame WebSocket connected.");},
    );

    return () => ws.close();
  }, [])

  if (!isConnected) {
    return <div>Connecting to pregame server...</div>;
  }

  return (
    <ReadyContext.Provider value={{ numReadyPlayers}}>
      <div inert={inert}>
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