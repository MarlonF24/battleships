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
        // Optionally, add default event listeners here
        // this._socket.onopen = ...
        // this._socket.onclose = ...
        // this._socket.onerror = ...
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