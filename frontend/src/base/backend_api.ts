declare global {
    interface Window {
        BACKEND_ORIGIN: string;
    }
}


import { DefaultApi, Configuration, ResponseError } from "./api-client/index";
export { ResponseError } from "./api-client/index";
export * as apiModels from "./api-client/models";
import * as socketModels from "./socketModels";
export * as socketModels from "./socketModels";
export { Orientation } from "./socketModels";
import { Page } from "../routing/switch_view";
import { create, fromBinary, Message, Registry, toBinary } from "@bufbuild/protobuf"; 

export async function unpackErrorMessage(error: ResponseError): Promise<string> {
    const response = await error.response.json();
    const detail = response.detail instanceof Array ? response.detail[0] : response.detail;
    const message = typeof detail === "string" ? detail : detail.msg;
    return error.response.status + ": " + message;
}

const BACKEND_ORIGIN = import.meta.env.VITE_BACKEND_ORIGIN ?? window.location.origin;

window.BACKEND_ORIGIN = BACKEND_ORIGIN;

export const api = new DefaultApi(new Configuration({ basePath: `http://${BACKEND_ORIGIN}` }));


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


// export type CaseFromValue<T, V> = T extends { case: infer C; value: infer Val }
//   ? (V extends Val ? C : never)
//   : never;

// type MyCase = CaseFromValue<socketModels.PlayerMessage["payload"], socketModels.GamePlayerMessage>; 


type GeneralPlayerMessagePayload = Exclude<socketModels.GeneralPlayerMessage["payload"], {case: undefined, value?: undefined}>;


export function sendGeneralPlayerMessage(message: GeneralPlayerMessagePayload): void {
    const wrappedMessage = create(socketModels.GeneralPlayerMessageSchema, {
        payload: message
    });
    

    BackendWebSocket.sendPlayerMessage({case: "generalMessage", value: wrappedMessage});
}


type PlayerMessagePayload = Exclude<socketModels.PlayerMessage["payload"], {case: undefined, value?: undefined}>;

export class BackendWebSocket {
    private static currentSocket: CurrentSocket | null = null;

    static get socket(): WebSocket {
        if (!this.currentSocket) {
            throw new Error("WebSocket not connected. Call BackendWebSocket.connect(page, gameId, playerId) first.");
        }
        return this.currentSocket.socket;
    }


    static sendPlayerMessage(message: PlayerMessagePayload): void {
        const wrappedMessage = create(socketModels.PlayerMessageSchema, {
            payload: message
        });
        BackendWebSocket.socket.send(toBinary(socketModels.PlayerMessageSchema, wrappedMessage));
    }

    static createMessageHandler(handler: (event: socketModels.ServerMessage) => void, addAsListener: boolean = true) {
        const socket = BackendWebSocket.socket;

        if (!socket) throw new Error("Tried to register message handler but WebSocket is not connected.");

        const wrappedHandler = (event: MessageEvent) => {
            const bytes = new Uint8Array(event.data);
            const message = fromBinary(socketModels.ServerMessageSchema, bytes);
            handler(message);
        }

        if (addAsListener) socket.addEventListener("message", wrappedHandler);
        
        return wrappedHandler;
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
            this.currentSocket.socket.close();
            this.currentSocket = null;
        }

        const newSocket = new WebSocket(`ws://${BACKEND_ORIGIN}/games/ws/${gameId}/${page}?playerId=${playerId}`);
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

        newSocket.onmessage =  this.createMessageHandler(async (message) => {
            this.defaultOnMessage(message);
            await onMessage?.(message);
        }, false);

        


        return this.currentSocket.socket;
    }
}