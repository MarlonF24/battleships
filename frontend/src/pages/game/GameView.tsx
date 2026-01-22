
import { useLoaderData } from "react-router-dom";

import { GameId, WebSocketProvider } from "../../base/index.js";
import { useSwitchView } from "../../routing/switch_view.js";
import GameWebsocketStore from "./GameWebsocket.js";
import { GameViewLoaderData } from "../pregame/index.js";
import GameArea from "./GameArea.js";


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