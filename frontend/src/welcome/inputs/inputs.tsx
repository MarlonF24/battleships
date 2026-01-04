import { useSwitchView, AppPhase } from "../../routing/switch_view";
import { api } from "../../backend_api";
import { useApi } from "../../utility/component";
import "./inputs.css";


export const JoinGameInput: React.FC = () => {
    const {error, executeApi} = useApi(); 
    const switchView = useSwitchView();
    
    const dispatchJoin = (event: React.FormEvent) => executeApi(async () => {
        
        const formData = new FormData(event.target as HTMLFormElement);
        const gameId = formData.get("gameId")!.toString();

        
        console.log("Attempting to join game with ID:", gameId);

        const playerId = localStorage.getItem("playerId")!;

        await api.joinGameGamesGamesGameIdJoinPost({gameId, playerId});
        switchView(AppPhase.PREGAME, gameId);
        console.log(`Successfully joined game with ID: ${gameId}`);  
    });

    return (
        <form onSubmit={dispatchJoin} id="join-game-form">
            {error && <span className="error-message">Error: {error}</span>}
            <label htmlFor="game-id-input">Join an existing game:</label>
            
            <input type="text" name="gameId" id="game-id-input" placeholder="Enter Game ID" required/>
            
            <input type="submit" value="Join Game" id="joinGameButton"/>
        </form>
    )
}

