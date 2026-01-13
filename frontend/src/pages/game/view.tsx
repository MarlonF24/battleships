import React from "react";
import { useLoaderData } from "react-router-dom";

import { apiModels, GameId } from "../../base";
import { GameGrid } from "./GameGrid/GameGrid";
import { GameViewLoaderData } from "../pregame";


const GameView: React.FC = () => {
    const { gameParams, gameId } = useLoaderData<GameViewLoaderData>();





    // new GameGrid({rows: gameParams.battleGridRows, cols: gameParams.battleGridCols}, shipLengths=gameParams.shipLengths,activeShips=gameParams.ownShips);


    return (
        <> 
            <GameId gameId={gameId}/> 
            
        </>
    );

}

export default GameView;