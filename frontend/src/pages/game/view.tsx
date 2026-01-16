import React, { useState } from "react";
import { useLoaderData } from "react-router-dom";

import { GameId, OpponentConnection } from "../../base";
import GameWebsocketStore from "./GameWebsocket";
import { GameViewLoaderData } from "../pregame";
import { useSwitchView } from "../../routing/switch_view";



const GameView: React.FC = () => {
    const { gameParams, gameId } = useLoaderData<GameViewLoaderData>();

    const switchView = useSwitchView();

    const [WS] = useState(() => new GameWebsocketStore(gameId, switchView, gameParams));
   
    if (!WS.gameGrids) {
        return <div>Loading game grids...</div>;
    }

    const {ownGameGrid, opponentGameGrid} = WS.gameGrids;

    return (
        <> 
            <GameId gameId={gameId}/> 
            <ownGameGrid.Renderer fleetPosition="left" opponent={false} />
            <opponentGameGrid.Renderer fleetPosition="right" opponent={true} />
        </>
    );

}

export default GameView;