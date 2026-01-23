export function getPlayerId(): string | null {
    const storage: "DEVELOPMENT" | "PRODUCTION" = import.meta.env.VITE_PLAYERID_BROWSER_STORAGE?.toUpperCase() ?? "PRODUCTION";

    if (storage === "DEVELOPMENT") {
        return sessionStorage.getItem("playerId");
    } 

    if (storage !== "PRODUCTION") {
        console.warn(`Unknown VITE_PLAYERID_BROWSER_STORAGE value: ${storage}. Expected "DEVELOPMENT" or "PRODUCTION". Falling back to PRODUCTION.`);
    }

    return localStorage.getItem("playerId");
}

export function setPlayerId(playerId: string): void {
    const storage: "DEVELOPMENT" | "PRODUCTION" = import.meta.env.VITE_PLAYERID_BROWSER_STORAGE ?? "PRODUCTION";
    if (storage === "DEVELOPMENT") {
        sessionStorage.setItem("playerId", playerId);
        return;
    }

    if (storage !== "PRODUCTION") {
        console.warn(`Unknown VITE_PLAYERID_BROWSER_STORAGE value: ${storage}. Expected "DEVELOPMENT" or "PRODUCTION". Falling back to PRODUCTION.`);
    }
    localStorage.setItem("playerId", playerId);
}