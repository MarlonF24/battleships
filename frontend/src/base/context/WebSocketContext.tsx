import { createContext, useContext } from "react";
import { Message } from "@bufbuild/protobuf";
import { action, makeObservable, observable } from "mobx";
import { NavigateFunction } from "react-router-dom";

import { BackendWebSocket } from "../api";
import { socketModels } from "../api";
import { Page } from "../../routing/switch_view";
import { useSwitchView } from "../../routing/switch_view";
import { OpponentConnection } from "../components";

export type ExcludeTypeField<T> = Omit<T, keyof Message<any>>;

type ServerPayload = Exclude<socketModels.ServerMessage["payload"], { case: undefined }>;

export class WebSocketStore {
    readonly opponentConnection: ExcludeTypeField<socketModels.ServerOpponentConnectionMessage> = { 
        opponentConnected: false, 
        initiallyConnected: false 
    };

    protected readonly handlers: {
        [P in ServerPayload as P["case"]]?: (payload: P["value"]) => void
    } = {};

    private readonly WS: WebSocket;

    constructor(page: Page.PREGAME | Page.GAME, readonly gameId: string, protected readonly navigation: ReturnType<typeof useSwitchView>) {
        this.registerHandler("generalMessage", this.handleGeneralServerMessage);

        makeObservable(this, {
            opponentConnection: observable,
            handleOpponentConnectionMessage: action,
        });

        const playerId = sessionStorage.getItem("playerId")!;
        
        this.WS = BackendWebSocket.connect(page, gameId, playerId, {
            onMessage: this.handleServerMessage,
            onClose: () => {
                console.log(`WebSocket connection for ${page} closed`);
                this.navigation(Page.ERROR, gameId, `Websocket connection for ${page} lost.`);
            }
        });
    }


    intentionalDisconnect() {
        this.WS.onclose = () => console.log("WebSocket closed intentionally from client side");
        this.WS.close();
    }


    protected registerHandler = <K extends keyof typeof this.handlers>(
        key: K,
        handler: NonNullable<typeof this.handlers[K]>
    ) => {
        this.handlers[key] = handler;
    }

    protected trigger = <P extends ServerPayload>(payload: P) => {
        
        const handler = this.handlers[payload.case] as 
            ((payload: P["value"]) => void) | undefined;

        if (handler) {
            handler(payload.value);
        } else {
            console.error(`Unhandled message type ${payload.case}: `, payload.value);
        }
    }

    private handleServerMessage = (message: socketModels.ServerMessage) => {
        if (message.payload.case !== undefined) {
            this.trigger(message.payload);
        }
    }

    handleGeneralServerMessage = (message: socketModels.GeneralServerMessage) => {
        if (message.payload.case === "opponentConnectionMessage") {
            this.handleOpponentConnectionMessage(message.payload.value);
        }
    }

    handleOpponentConnectionMessage = (message: socketModels.ServerOpponentConnectionMessage) => {
        console.log(`Opponent connection status changed: connected=${message.opponentConnected}`);
        Object.assign(this.opponentConnection, message);
    }
}

export const WebSocketContext = createContext<WebSocketStore | null>(null);

export const WebSocketProvider = ({ store, children }: { store: WebSocketStore, children: React.ReactNode }) => { 
    return (
        <WebSocketContext.Provider value={store}>
            <OpponentConnection/>
            <br/>
            {children}
        </WebSocketContext.Provider>
    );
};

export const useWebSocketStore = <T extends WebSocketStore>(StoreClass: new (...args: any[]) => T = WebSocketStore as any): T => {
    const context = useContext(WebSocketContext);
    if (!context || !(context instanceof StoreClass)) {
        throw new Error(`useWebSocketStore must be used within a Provider matching ${StoreClass.name}`);
    }
    return context;
};
