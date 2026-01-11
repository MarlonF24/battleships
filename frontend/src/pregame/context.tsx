import React, { createContext, ReactNode, useCallback, useContext, useState } from "react";
import { useEffect } from "react";
import { BackendWebSocket, Orientation, apiModels, OpponentConnection } from "../base";
import { useSwitchView, Page } from "../routing/switch_view.js";

interface ReadyContextType {
    numReadyPlayers: number;
}

const ReadyContext = createContext<ReadyContextType>(null!);

export interface PregameWSPlayerReadyMessage {
  ships: {length: number, orientation: Orientation, head_row: number, head_col: number}[];
}


export const ReadyContextProvider: React.FC<{ gameId: string, children: ReactNode }> = ({ gameId, children }) => {
  const [numReadyPlayers, setNumReadyPlayers] = useState(0);
  const [inert, setInert] = useState(true);
  const [websocketConnected, setWebsocketConnected] = useState(false);
  const [opponentConnected, setOpponentConnected] = useState<apiModels.WSServerOpponentConnectionMessage>({opponentConnected: false, initiallyConnected: false});
  const switchView = useSwitchView();


  const handleServerStateMessage = useCallback((message: apiModels.PregameWSServerStateMessage) => {
    
    setNumReadyPlayers(message.numPlayersReady);
    
    if (!message.selfReady) { // catch the first backend message after connecting
      setInert(false); 
    } else {
      console.log("You are marked as ready.");
      setInert(true); 
    }

    if (message.numPlayersReady === 2) {
      console.log("Both players ready! Starting game...");
      
      BackendWebSocket.socket.onclose = () => console.log("Pregame WebSocket closed after both players ready"); // server is expected to close the WS
      
      setTimeout(() => {
        // switchView(Page.GAME, gameId);
      }, 1000); // slight delay to allow players to see both are ready
    }			
  }, []);


  const pregameWSOnMessage = useCallback((event: MessageEvent) => {
    
    const message = JSON.parse(event.data);

    if (apiModels.instanceOfPregameWSServerStateMessage(message)) {
      handleServerStateMessage(message);
    
    } else if (apiModels.instanceOfWSServerOpponentConnectionMessage(message)) {
      console.log(`Opponent connection status changed: connected=${message.opponentConnected}`);
      setOpponentConnected(message);
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
      onClose: () => {switchView(Page.ERROR, undefined, "Connection to server lost during pregame phase."); } // closed from server side
    }
    );

    return () => {
      if (ws.readyState === WebSocket.OPEN) { // close the WS if still open at unmount
        ws.onclose = () => console.log("Pregame WebSocket closed"); 
        ws.close();
      }
    }; // closed due to component unmounting
  }, [])

  if (!websocketConnected) {
    return <div>Connecting to pregame server...</div>;
  }

  return (
    <ReadyContext.Provider value={{ numReadyPlayers}}>
      <OpponentConnection connectionInfo={opponentConnected}/>
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