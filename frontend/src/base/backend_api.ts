declare global {
    interface Window {
        BACKEND_ORIGIN: string;
    }
}


import { DefaultApi, Configuration, ResponseError } from "../api-client/index";
export { ResponseError } from "../api-client/index";
import { AppPhase } from "../routing/switch_view";

export async function unpackErrorMessage(error: ResponseError): Promise<string> {
    const response = await error.response.json();
    const detail = response.detail instanceof Array ? response.detail[0] : response.detail;
    return typeof detail === "string" ? detail : detail.msg;
}

const BACKEND_ORIGIN = import.meta.env.VITE_BACKEND_ORIGIN ?? window.location.origin;

window.BACKEND_ORIGIN = BACKEND_ORIGIN;

export const api = new DefaultApi(new Configuration({ basePath: `http://${BACKEND_ORIGIN}` }));



interface CurrentSocket {
    readonly socket: WebSocket;
    readonly phase: AppPhase;
}

export class BackendWebSocket {
    private static currentSocket: CurrentSocket | null = null;

    static get socket(): WebSocket {
        if (!this.currentSocket) {
            throw new Error("WebSocket not connected. Call BackendWebSocket.connect(phase, gameId, playerId) first.");
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
        console.log("WebSocket connection closed");
    }

    static defaultOnError = (event: Event) => {
        console.error("WebSocket error:", event);
    }

    static connect(phase: AppPhase, gameId: string, playerId: string, 
        onMessage: (event: MessageEvent) => void = BackendWebSocket.defaultOnMessage, 
        onOpen: (e: Event) => void = BackendWebSocket.defaultOnOpen, 
        onClose: (e: CloseEvent) => void = BackendWebSocket.defaultOnClose, 
        onError: (event: Event) => void = BackendWebSocket.defaultOnError): WebSocket {
        
        if (this.currentSocket) {
            this.currentSocket.socket.close();
            this.currentSocket = null;
        }

        const newSocket = new WebSocket(`ws://${BACKEND_ORIGIN}/games/ws/${gameId}/${phase}?playerId=${playerId}`);
        
        newSocket.onopen = onOpen;

        newSocket.onerror = onError;
        newSocket.onclose = (e) => {
            onClose(e);
            this.currentSocket = null;
        }

        if (onMessage) newSocket.onmessage = onMessage;

        this.currentSocket = {
            phase,
            socket: newSocket
        };

        return this.currentSocket.socket;
    }
}