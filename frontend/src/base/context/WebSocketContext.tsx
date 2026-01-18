import React, { createContext, useContext, useState, useEffect } from "react";
import { Constructor } from "protobufjs";


import { WebSocketStore } from "../api";
import { OpponentConnection } from "../components";

export { WebSocketStore } from "../api";

export const WebSocketContext = createContext<WebSocketStore | null>(null);



export const WebSocketProvider = <T extends Constructor<WebSocketStore>>({ children, storeClass, args }: { children: React.ReactNode, storeClass: T, args: ConstructorParameters<T>}) => { 

    const [WS] = useState(() => new storeClass(...args));
    
    // Clean up on unmount
	useEffect(() => {
		return () => {
			WS.intentionalDisconnect();
		};
	}, []);
    
    return (
        <WebSocketContext.Provider value={WS}>
            <OpponentConnection/>
            <br/>
            {children}
        </WebSocketContext.Provider>
    );
};


export const useWebSocketStore = <T extends WebSocketStore = WebSocketStore>(StoreClass: Constructor<T> = WebSocketStore as any): T => {
    const context = useContext(WebSocketContext);
    if (!context || !(context instanceof StoreClass)) {
        throw new Error(`useWebSocketStore must be used within a Provider matching ${StoreClass.name}`);
    }

    return context;
};
