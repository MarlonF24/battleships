import { create } from "@bufbuild/protobuf";
import { BackendWebSocket, socketModels } from "../../base";

type PregamePlayerMessagePayload = Exclude<socketModels.PregamePlayerMessage["payload"], {case: undefined, value?: undefined}>;

const sendPregamePlayerMessage = (message: PregamePlayerMessagePayload): void => {
    const wrappedMessage = create(socketModels.PregamePlayerMessageSchema, {
        payload: message
    });
    console.log("Sending pregame player message:", wrappedMessage);
    BackendWebSocket.sendPlayerMessage({case: "pregameMessage", value: wrappedMessage});
}

export default sendPregamePlayerMessage;