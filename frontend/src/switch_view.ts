interface ViewSwitchDetail {
    newPhase: AppPhase;
    gameId?: string;
}


export class ViewSwitchEvent extends CustomEvent<ViewSwitchDetail> {
    constructor(newPhase: AppPhase, gameId?: string) {
        super("view-switch", {detail: {newPhase, gameId}});
    }
}

export enum AppPhase {
    WELCOME = "welcome",
    PREGAME = "pregame",
    GAME = "game"
}


export function switchToView(phase: AppPhase, gameId?: string) {
    window.dispatchEvent(new ViewSwitchEvent(phase, gameId));
}
