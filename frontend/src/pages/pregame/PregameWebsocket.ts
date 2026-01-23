import { WebSocketStore, ExcludeMessageTypeField, socketModels, MessagePayload,  } from "../../base/index.js";
import { Page, useSwitchView } from "../../routing/switch_view.js";
import { makeObservable, observable } from "mobx";
import { create } from "@bufbuild/protobuf";
import { BattleGrid } from "./BattleGrid/BattleGrid.js";


export class PregameWebSocketStore extends WebSocketStore {
  public readonly readyState: ExcludeMessageTypeField<socketModels.PregameServerReadyStateMessage> = {
    numReadyPlayers: 0,
    selfReady: false,
  };
  
  constructor(gameId: string, navigation: ReturnType<typeof useSwitchView>) {
      super(Page.PREGAME, gameId, navigation);
      
        
      this.registerHandler("pregameMessage", this.pregameMessageHandler);

      makeObservable(this, {
          readyState: observable,
          handleReadyStateMessage: true,
          setSelfReady: true
      });
  }

  pregameMessageHandler = (message: socketModels.PregameServerMessage) => {
      switch (message.payload.case) {
          case "readyState":
              console.debug("Received ready state message:", message.payload.value);
              this.handleReadyStateMessage(message.payload.value);
              break;
          default:
              console.warn("Unhandled pregame message type:", message.payload.case);
      }
  }

  handleReadyStateMessage = (message: socketModels.PregameServerReadyStateMessage) => {
      this.readyState.numReadyPlayers = message.numReadyPlayers;
        if (!this.readyState.selfReady) this.readyState.selfReady = message.selfReady; // only update if false to avoid edge cases where opponent gets ready right before us and sends us an outdated state   

      console.log("Updated ready state:, numReadyPlayers:", this.readyState.numReadyPlayers, "selfReady:", this.readyState.selfReady);

      if (this.readyState.numReadyPlayers === 2) {
          console.log("Both players are ready!, Switching to game view...");
          setTimeout(() => {
            // WS disconnection is handled by unmounting of the websocket context
            this.navigation(Page.GAME, this.gameId);
          }, 1500); // slight delay to allow players to see both are ready
      } 
  }

  setSelfReady = (ready: boolean) => {
      this.readyState.selfReady = ready;
  }



    sendPregamePlayerMessage = <T extends MessagePayload<socketModels.PregamePlayerMessage>>(message: T): void => {
        const wrappedMessage = create(socketModels.PregamePlayerMessageSchema, {
            payload: message
        });
        console.debug("Sending pregame player message:", message);
        this.sendPlayerMessage({case: "pregameMessage", value: wrappedMessage});
    }

    sendPlayerReadyMessage(battleGrid: BattleGrid): void {
    
        let ships: socketModels.PregamePlayerSetReadyStateMessage["ships"] = [];
        
        for (let [ship, position] of battleGrid.ships) {
            ships.push(
                create(socketModels.ShipSchema,
                    {length: ship.length, orientation: ship.orientation, headRow: position.headRow, headCol: position.headCol})
                );
        }

        let WSMessage: socketModels.PregamePlayerSetReadyStateMessage = create(socketModels.PregamePlayerSetReadyStateMessageSchema, {ships: ships});


        this.sendPregamePlayerMessage({case: "setReadyState", value: WSMessage});
        
        console.log("Player is ready!");

        this.setSelfReady(true);
        // not assigning the numReadyPlayers here, we expect the server to broadcast the updated count, the self ready we only set to make the UI inert
    }

}
