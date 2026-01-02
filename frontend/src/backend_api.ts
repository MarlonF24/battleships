declare global {
    interface Window {
        BACKEND_ORIGIN: string;
    }
}



import { DefaultApi, Configuration } from "./api-client/index";
export { ResponseError } from "./api-client/index";
import { ResponseError } from "./api-client/index";
const BACKEND_ORIGIN = import.meta.env.VITE_BACKEND_ORIGIN ?? window.location.origin;

window.BACKEND_ORIGIN = BACKEND_ORIGIN;

export const api = new DefaultApi(new Configuration({ basePath: `http://${BACKEND_ORIGIN}` }));

export async function unpackErrorMessage(error: ResponseError): Promise<string> {
    const response = await error.response.json();
    const detail = response.detail instanceof Array ? response.detail[0] : response.detail;
    return typeof detail === "string" ? detail : detail.msg;
}

export class BackendWebSocket {
    private static _socket: WebSocket | null = null;
    private static _url: string | null = null;


    static get socket(): WebSocket {
        if (!this._socket) {
            throw new Error("WebSocket not connected. Call BackendWebSocket.connect(url) first.");
        }
        return this._socket;
    }

    /**
     * Connects (or reconnects) the singleton WebSocket to the given URL.
     * If already connected to the same URL, does nothing.
     */
    static connect(url: string): WebSocket {
        if (this._socket && this._socket.url === url && this._socket.readyState === WebSocket.OPEN) {
            throw new Error("WebSocket already connected to the given URL.");
        }
        
        if (this._socket) {
            this._socket.close();
        }
        this._url = url;
        this._socket = new WebSocket(url);
       
        return this._socket;
    }


    static disconnect() {
        if (this._socket) {
            this._socket.close();
            this._socket = null;
            this._url = null;
        }
    }

    static get url(): string | null {
        return this._url;
    }
}