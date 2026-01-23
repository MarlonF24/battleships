import { makeObservable, observable, action } from "mobx";
import { create, Message } from "@bufbuild/protobuf";
import { Page, useSwitchView } from "../../../routing/switch_view";
import * as socketModels from "../socketModels";
import { BackendWebSocket } from "./ws";
import { getPlayerId } from "../../utility";

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

        const playerId = getPlayerId()!;
        
        this.WS = BackendWebSocket.connect(page, gameId, playerId, {
            onMessage: this.handleServerMessage,
            onClose: (e: CloseEvent) => {
                if (e.code ===  1000) {
                    console.log("WebSocket closed normally:", e.reason);
                    return;
                }

                const message = `WebSocket connection for ${page} lost abnormally. ${e.code ? `Code: ${e.code}` : ""}  ${e.reason ? `Reason: ${e.reason}` : ""}`;
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
        switch (message.payload.case) {
            case "opponentConnectionMessage":
                this.handleOpponentConnectionMessage(message.payload.value);
                break;
            case "heartbeatRequest":
                this.handleHeartbeatRequest(message.payload.value);
                break;
            default:
                console.error(`Unhandled GeneralServerMessage type: ${message.payload.case}`);
        }
    }

    handleOpponentConnectionMessage = (message: socketModels.ServerOpponentConnectionMessage) => {
        console.log(`Opponent connection status changed: connected=${message.opponentConnected} (initially_connected=${message.initiallyConnected})`);
        Object.assign(this.opponentConnection, message);
    }


    handleHeartbeatRequest = (message: socketModels.ServerHeartbeatRequest) => {
        const response = create(socketModels.PlayerHeartbeatResponseSchema, {});
        this.sendGeneralPlayerMessage({case: "heartbeatResponse", value: response});
    }

    
    sendGeneralPlayerMessage = <T extends MessagePayload<socketModels.GeneralPlayerMessage>>(message: T): void => {
        const wrappedMessage = create(socketModels.GeneralPlayerMessageSchema, {
            payload: message
        });

        console.debug("Sending general player message:", message);
        this.sendPlayerMessage({case: "generalMessage", value: wrappedMessage});
    }

    sendPlayerMessage = <T extends MessagePayload<socketModels.PlayerMessage>>(message: T): void => {
        const wrappedMessage = create(socketModels.PlayerMessageSchema, {
            timestamp: BigInt(Date.now()),
            payload: message
        });

        console.debug("Sending player message:", message);
        BackendWebSocket.sendPlayerMessage(this.WS, wrappedMessage);
    }


}