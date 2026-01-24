export function getPlayerId(): string | null {
    const storage: "SESSION" | "LOCAL" = import.meta.env.VITE_PLAYERID_BROWSER_STORAGE?.toUpperCase() ?? "LOCAL";

    if (storage === "SESSION") {
        return sessionStorage.getItem("playerId");
    } 

    if (storage !== "LOCAL") {
        console.warn(`Unknown VITE_PLAYERID_BROWSER_STORAGE value: ${storage}. Expected "SESSION" or "LOCAL". Falling back to LOCAL.`);
    }

    return localStorage.getItem("playerId");
}

export function setPlayerId(playerId: string): void {
    const storage: "SESSION" | "LOCAL" = import.meta.env.VITE_PLAYERID_BROWSER_STORAGE?.toUpperCase() ?? "LOCAL";
    if (storage === "SESSION") {
        sessionStorage.setItem("playerId", playerId);
        return;
    }

    if (storage !== "LOCAL") {
        console.warn(`Unknown VITE_PLAYERID_BROWSER_STORAGE value: ${storage}. Expected "SESSION" or "LOCAL". Falling back to LOCAL.`);
    }
    localStorage.setItem("playerId", playerId);
}