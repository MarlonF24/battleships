import { WebSocketStore, ExcludeTypeField, socketModels } from "../../base/index.js";
import { useSwitchView, Page } from "../../routing/switch_view.js";
import { action, makeObservable, observable } from "mobx";


export class PregameWebSocketStore extends WebSocketStore {
  public readonly readyState: ExcludeTypeField<socketModels.PregameServerReadyStateMessage> = {
    numReadyPlayers: 0,
    selfReady: false,
  };
  
  constructor(gameId: string, navigation: ReturnType<typeof useSwitchView>) {
      super(Page.PREGAME, gameId, navigation);
      
        
      this.registerHandler("pregameMessage", this.pregameMessageHandler);

      makeObservable(this, {
          readyState: observable,
          handleReadyStateMessage: action,
      });
  }

  pregameMessageHandler = (message: socketModels.PregameServerMessage) => {
      switch (message.payload.case) {
          case "readyState":
              console.log("Received ready state message:", message.payload.value);
              this.handleReadyStateMessage(message.payload.value);
              break;
          default:
              console.warn("Unhandled pregame message type:", message.payload.case);
      }
  }

  handleReadyStateMessage = (message: socketModels.PregameServerReadyStateMessage) => {
      Object.assign(this.readyState, message);
      console.log("Updated ready state:", this.readyState);

      if (this.readyState.numReadyPlayers === 2) {
          console.log("Both players are ready!, Switching to game view...");
          setTimeout(() => {
            this.intentionalDisconnect();
            this.navigation(Page.GAME);
          }, 1500); // slight delay to allow players to see both are ready
      } 
  }

}
