import React, { createContext, ReactNode, useCallback, useContext, useState, useEffect } from "react";

import { BackendWebSocket, socketModels, OpponentConnection } from "../../base";
import { useSwitchView, Page } from "../../routing/switch_view.js";

interface ReadyContextType {
    numReadyPlayers: number;
}

const ReadyContext = createContext<ReadyContextType>(null!);


export const ReadyContextProvider: React.FC<{ gameId: string, children: ReactNode }> = ({ gameId, children }) => {
  const [numReadyPlayers, setNumReadyPlayers] = useState(0);
  const [inert, setInert] = useState(true);
  const [websocketConnected, setWebsocketConnected] = useState(false);
  
  const switchView = useSwitchView();


  const handleServerStateMessage = useCallback((message: socketModels.PregameServerReadyStateMessage) => {
    
    setNumReadyPlayers(message.numReadyPlayers);
    
    if (!message.selfReady) { // catch the first backend message after connecting
      setInert(false); 
    } else {
      console.log("You are marked as ready.");
      setInert(true); 
    }

    if (message.numReadyPlayers === 2) {
      console.log("Both players ready! Starting game...");
      
      BackendWebSocket.socket.onclose = () => console.log("Pregame WebSocket closed after both players ready"); // server is expected to close the WS
      
      setTimeout(() => {
        // switchView(Page.GAME, gameId);
        BackendWebSocket.socket.close(); 
      }, 1000); // slight delay to allow players to see both are ready
    }			
  }, []);


  const pregameWSOnMessage = useCallback((message: socketModels.ServerMessage) => {
    const outerPayload = message.payload;
    if (outerPayload.case === "pregameMessage") {
      let innerPayload = outerPayload.value;
      if (innerPayload.payload.case === "readyState") {
        handleServerStateMessage(innerPayload.payload.value);
      }
    } 
  }, []);

  useEffect(() => {
  
    setWebsocketConnected(false);
    const ws = BackendWebSocket.connect(
      Page.PREGAME,
      gameId,
      sessionStorage.getItem("playerId")!,
      {onMessage: pregameWSOnMessage,
      onOpen: () => {setWebsocketConnected(true)},
      onClose: () => {switchView(Page.ERROR, gameId, "Connection to server lost during pregame phase."); } // closed from server side
    }
    );

    return () => {
      if (ws.readyState === WebSocket.OPEN) { // close the WS if still open at unmount
        ws.onclose = () => console.log("Pregame WebSocket closed"); 
        ws.close();
      }
    }; // closed due to component unmounting
  }, [gameId])

  if (!websocketConnected) {
    return <div>Connecting to pregame server...</div>;
  }

  return (
    <ReadyContext.Provider value={{ numReadyPlayers}}>
      <OpponentConnection/>
      <br/>
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