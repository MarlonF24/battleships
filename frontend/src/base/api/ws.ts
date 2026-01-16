import { create, fromBinary, toBinary } from "@bufbuild/protobuf";

import * as socketModels from "./socketModels";
import { Page } from "../../routing/switch_view";

interface CurrentSocket {
    readonly socket: WebSocket;
    readonly page: Page;
}

interface WebSocketHandlers {
    onMessage?: (event: socketModels.ServerMessage) => void | Promise<void>;
    onOpen?: (e: Event) => void | Promise<void>;
    onClose?: (e: CloseEvent) => void | Promise<void>;
    onError?: (event: Event) => void | Promise<void>;
}



type PlayerMessagePayload = Exclude<socketModels.PlayerMessage["payload"], {case: undefined, value?: undefined}>;



export class BackendWebSocket {
    private static currentSocket: CurrentSocket | null = null;

    private static get socket(): WebSocket {
        if (!this.currentSocket) {
            throw new Error("WebSocket not connected. Call BackendWebSocket.connect(page, gameId, playerId) first.");
        }
        return this.currentSocket.socket;
    }

    
    
    static sendPlayerMessage(message: PlayerMessagePayload): void {
        const wrappedMessage = create(socketModels.PlayerMessageSchema, {
            payload: message
        });
        console.log("Sending player message:", wrappedMessage);
        BackendWebSocket.socket.send(toBinary(socketModels.PlayerMessageSchema, wrappedMessage));
    }


    private static createMessageHandler(handler: (event: socketModels.ServerMessage) => void, addAsListener: boolean = true): {wrappedHandler: (event: MessageEvent) => void, removeHandler: () => void} {
        const socket = BackendWebSocket.socket;

        if (!socket) throw new Error("Tried to register message handler but WebSocket is not connected.");

        const wrappedHandler = (event: MessageEvent) => {
            const bytes = new Uint8Array(event.data);
            const message = fromBinary(socketModels.ServerMessageSchema, bytes);
            handler(message);
        }

        
        const removeHandler = () => {
            socket.removeEventListener("message", wrappedHandler);
        }
        
        
        if (addAsListener) socket.addEventListener("message", wrappedHandler);


        
        return {wrappedHandler, removeHandler};
    }



    static defaultOnMessage = (message: socketModels.ServerMessage) => {
        console.log("WebSocket message received:", message.payload.value);
    }

    static defaultOnOpen = (e: Event) => {
        console.log("WebSocket connection established");
    }

    static defaultOnClose = (e: CloseEvent) => {
        this.currentSocket = null;
        console.log("WebSocket connection closed and cleared");
    }

    static defaultOnError = (event: Event) => {
        console.error("WebSocket error:", event);
    }

    static connect(page: Page.PREGAME | Page.GAME, gameId: string, playerId: string, 
        {onMessage = undefined, 
        onOpen = undefined, 
        onClose = undefined, 
        onError = undefined}: Partial<WebSocketHandlers> = {}): WebSocket {
        
        if (this.currentSocket) {
            if (this.currentSocket.page === page) {
                console.warn("Connecting to a new websocket on the same page. Closing the existing connection first. Check whether that is intended.");
            } else {
                console.log(`Closing existing WebSocket for ${this.currentSocket.page} connection before opening a new one for ${page}.`);
            }

            this.currentSocket.socket.close();
            this.currentSocket = null;
        }

        const newSocket = new WebSocket(`ws://${window.BACKEND_ORIGIN}/games/ws/${gameId}/${page}?playerId=${playerId}`);
        newSocket.binaryType = "arraybuffer";
        
        this.currentSocket = {
            page,
            socket: newSocket
        };
        
        newSocket.onopen = async (e) => {
            await onOpen?.(e);
            this.defaultOnOpen(e);
        };

        newSocket.onerror = async (e) => {
            await onError?.(e);
            this.defaultOnError(e);
        };

        newSocket.onclose = async (e) => {
            await onClose?.(e);
            this.defaultOnClose(e);
        }

        newSocket.onmessage = this.createMessageHandler(async (message) => {
            this.defaultOnMessage(message);
            await onMessage?.(message);
        }, false).wrappedHandler;

        
        return this.currentSocket.socket;
    }
}