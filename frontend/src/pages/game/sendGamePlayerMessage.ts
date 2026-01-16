import { create } from "@bufbuild/protobuf";
import { BackendWebSocket, socketModels } from "../../base";

type GamePlayerMessagePayload = Exclude<socketModels.GamePlayerMessage["payload"], {case: undefined, value?: undefined}>;

const sendGamePlayerMessage = (message: GamePlayerMessagePayload): void => {
    const wrappedMessage = create(socketModels.GamePlayerMessageSchema, {
        payload: message
    });
    console.log("Sending Game player message:", wrappedMessage);
    BackendWebSocket.sendPlayerMessage({case: "gameMessage", value: wrappedMessage});
}

export default sendGamePlayerMessage;