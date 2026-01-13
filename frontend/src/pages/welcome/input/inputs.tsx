import { useSwitchView, Page } from "../../../routing/switch_view";
import { useApi, api } from "../../../base";
import "./inputs.css";


export const JoinGameInput: React.FC = () => {
    const {loading, error, executeApi} = useApi(); 
    const switchView = useSwitchView();
    
    const dispatchJoin = (event: React.FormEvent) => executeApi(async () => {
        event.preventDefault();
        const formData = new FormData(event.target as HTMLFormElement);
        const gameId = formData.get("gameId")!.toString();

        
        console.log("Attempting to join game with ID:", gameId);

        const playerId = sessionStorage.getItem("playerId")!;

        await api.joinGameGamesGameIdJoinPost({gameId, playerId});
        switchView(Page.PREGAME, gameId);
        console.log(`Successfully joined game with ID: ${gameId}`);  
    });

    return (
        <form onSubmit={dispatchJoin} className="join-game-form">
            {error && <span className="error-message">Error: {error}</span>}
            <label htmlFor="game-id-input">Join an existing game:</label>
            
            <input type="text" name="gameId" id="game-id-input" className="game-id-input" placeholder="Enter Game ID" required/>
            
            <button type="submit" className="btn-success" disabled={loading}>
                {loading ? "Joining..." : "Join Game"}
            </button>
        </form>
    )
}

