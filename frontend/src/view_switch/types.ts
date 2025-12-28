interface ViewSwitchDetail {
    newPhase: AppPhase;
    gameID?: string;
}


export class ViewSwitchEvent extends CustomEvent<ViewSwitchDetail> {
    constructor(newPhase: AppPhase, gameID?: string) {
        super("view-switch", {detail: {newPhase, gameID}});
    }
}

export enum AppPhase {
    WELCOME = "welcome",
    PREGAME = "pregame",
    GAME = "game"
}


export function switchToView(phase: AppPhase, gameID?: string, changeHistory: boolean = false) {
    window.dispatchEvent(new ViewSwitchEvent(phase, gameID));

    if (changeHistory) {
        window.history.pushState({}, "", `/${phase}${gameID ? `?gameId=${gameID}` : ""}`);
    }
}
