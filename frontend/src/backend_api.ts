declare global {
    interface Window {
        BACKEND_ORIGIN: string;
    }
}


import { DefaultApi, Configuration } from "./api-client/index";
export { ResponseError } from "./api-client/index";
import { ResponseError } from "./api-client/index";
import { AppPhase } from "./routing/switch_view";


const BACKEND_ORIGIN = import.meta.env.VITE_BACKEND_ORIGIN ?? window.location.origin;

window.BACKEND_ORIGIN = BACKEND_ORIGIN;

export const api = new DefaultApi(new Configuration({ basePath: `http://${BACKEND_ORIGIN}` }));

export async function unpackErrorMessage(error: ResponseError): Promise<string> {
    const response = await error.response.json();
    const detail = response.detail instanceof Array ? response.detail[0] : response.detail;
    return typeof detail === "string" ? detail : detail.msg;
}

interface CurrentSocket {
    readonly socket: WebSocket;
    readonly phase: AppPhase;
}

export class BackendWebSocket {
    private static currentSocket: CurrentSocket | null = null;

    static get socket(): WebSocket {
        if (!this.currentSocket) {
            throw new Error("WebSocket not connected. Call BackendWebSocket.connect(url) first.");
        }
        return this.currentSocket.socket;
    }

    static connect(phase: AppPhase, gameId: string, playerId: string): WebSocket {
        if (this.currentSocket?.phase === phase) {
            throw new Error("WebSocket already connected to the given URL.");
        }
        
        if (this.currentSocket) {
            this.disconnect();
        }

        this.currentSocket = {
            phase,
            socket: new WebSocket(`ws://${BACKEND_ORIGIN}/games/ws/${gameId}/${phase}?playerId=${playerId}`)
        };

        return this.currentSocket.socket;
    }

    static disconnect() {
        this.currentSocket?.socket.close();
        this.currentSocket = null;
    }
}