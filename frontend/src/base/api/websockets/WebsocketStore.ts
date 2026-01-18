import { makeObservable, observable, action } from "mobx";
import { create, Message } from "@bufbuild/protobuf";
import { Page, useSwitchView } from "../../../routing/switch_view";
import * as socketModels from "../socketModels";
import { BackendWebSocket } from "./ws";

export type ExcludeMessageTypeField<T> = Omit<T, keyof Message<any>>;

export type MessagePayload<T extends {payload: {case: any | undefined, value?: any | undefined}}> = Exclude<T["payload"], { case: undefined }>;



export class WebSocketStore {
    readonly opponentConnection: ExcludeMessageTypeField<socketModels.ServerOpponentConnectionMessage> = { 
        opponentConnected: false, 
        initiallyConnected: false 
    };

    protected readonly handlers: {
        [P in MessagePayload<socketModels.ServerMessage> as P["case"]]?: (payload: P["value"]) => void
    } = {};

    private readonly WS: WebSocket;

    constructor(protected readonly page: Page.PREGAME | Page.GAME, protected readonly gameId: string, protected readonly navigation : ReturnType<typeof useSwitchView>) {
        
        this.registerHandler("generalMessage", this.handleGeneralServerMessage);

        makeObservable(this, {
            opponentConnection: observable,
            handleOpponentConnectionMessage: action,
        });

        const playerId = sessionStorage.getItem("playerId")!;
        
        this.WS = BackendWebSocket.connect(page, gameId, playerId, {
            onMessage: this.handleServerMessage,
            onClose: (e: CloseEvent) => {
                if (e.code ===  1000) {
                    console.log("WebSocket closed normally:", e.reason);
                    return;
                }

                const message = `WebSocket connection for ${page} lost abnormally. Code: ${e.code}, Reason: ${e.reason}`
                console.error(message);
                this.navigation(Page.ERROR, gameId, message);
            }
        });
    }

    intentionalDisconnect() {
        this.WS.close(1000, "Client intentional disconnect, page change or refresh.");
    }

    protected registerHandler = <K extends keyof typeof this.handlers>(
        key: K,
        handler: NonNullable<typeof this.handlers[K]>
    ) => {
        this.handlers[key] = handler;
    }

    protected trigger = <P extends MessagePayload<socketModels.ServerMessage>>(payload: P) => {
        
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

    sendPlayerMessage = <T extends MessagePayload<socketModels.PlayerMessage>>(message: T): void => {
        const wrappedMessage = create(socketModels.PlayerMessageSchema, {
            payload: message
        });
        console.log("Sending player message:", message);
        BackendWebSocket.sendPlayerMessage(this.WS, wrappedMessage);
    }


}