
import { useLoaderData } from "react-router-dom";

import { GameId, WebSocketProvider } from "../../base";
import { useSwitchView } from "../../routing/switch_view.js";
import GameWebsocketStore from "./GameWebsocket";
import { GameViewLoaderData } from "../pregame";
import GameArea from "./GameArea";


const GameView = () => {
    const { gameId, gameParams } = useLoaderData<GameViewLoaderData>();
    const switchView = useSwitchView();

    return (
        <> 
            <GameId gameId={gameId}/> 
            <WebSocketProvider storeClass={GameWebsocketStore} args={[gameId, switchView, gameParams]}>
                <GameArea />
            </WebSocketProvider>
        </>
    );

}

export default GameView;