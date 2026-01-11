declare global {
    interface Window {
        BACKEND_ORIGIN: string;
    }
}


import { DefaultApi, Configuration, ResponseError } from "../api-client/index";
export { ResponseError } from "../api-client/index";
export * as apiModels from "../api-client/models";
import { Page } from "../routing/switch_view";

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
    onMessage?: (event: MessageEvent) => void;
    onOpen?: (e: Event) => void;
    onClose?: (e: CloseEvent) => void;
    onError?: (event: Event) => void;
}

export class BackendWebSocket {
    private static currentSocket: CurrentSocket | null = null;

    static get socket(): WebSocket {
        if (!this.currentSocket) {
            throw new Error("WebSocket not connected. Call BackendWebSocket.connect(page, gameId, playerId) first.");
        }
        return this.currentSocket.socket;
    }

    static defaultOnMessage = (event: MessageEvent) => {
        console.log("WebSocket message received:", event.data);
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

    static connect(page: Page, gameId: string, playerId: string, 
        {onMessage = undefined, 
        onOpen = undefined, 
        onClose = undefined, 
        onError = undefined}: Partial<WebSocketHandlers> = {}): WebSocket {
        
        if (this.currentSocket) {
            this.currentSocket.socket.close();
            this.currentSocket = null;
        }

        const newSocket = new WebSocket(`ws://${BACKEND_ORIGIN}/games/ws/${gameId}/${page}?playerId=${playerId}`);
        
        newSocket.onopen = (e) => {
            onOpen?.(e);
            this.defaultOnOpen(e);
        };

        newSocket.onerror = (e) => {
            onError?.(e);
            this.defaultOnError(e);
        };

        newSocket.onclose = (e) => {
            onClose?.(e);
            this.defaultOnClose(e);
        }

        newSocket.onmessage = (event) => {
            onMessage?.(event);
            this.defaultOnMessage(event);
        };

        this.currentSocket = {
            page,
            socket: newSocket
        };

        return this.currentSocket.socket;
    }
}