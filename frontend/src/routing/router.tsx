
import { createBrowserRouter, LoaderFunction, Navigate } from "react-router-dom";
import { api, ResponseError, unpackErrorMessage, ErrorPage } from "../base/index.js";
import PreGameView, { PreGameViewLoaderData } from "../pregame/view.js";
import  WelcomeView  from "../welcome/view.js";
import GameView from "../game/view.js";


const pregameLoader: LoaderFunction<PreGameViewLoaderData> = async ({ params }) => {
  const gameId = params.gameId!;
  const playerId = sessionStorage.getItem("playerId")!;
  try {
    const gameParams = await api.getGameParamsGamesGameIdParamsGet({ gameId, playerId });
    
    
    return {gameParams, gameId};

    
  } catch (err) {
    if (err instanceof ResponseError) {
      const errorMessage = await unpackErrorMessage(err);
      throw new Error(errorMessage);
    }
    throw err;
  }
}

const gameLoader: LoaderFunction = async ({ params }) => {
  const gameId  = params.gameId!;
  const playerId = sessionStorage.getItem("playerId")!;
  
  const gameState = await api.getGameParamsGamesGameIdParamsGet({ gameId, playerId });
  return { ...gameState, gameId };
};


const router = createBrowserRouter([
  {
    path: "/",
    element: <Navigate to="/welcome" replace />
  },
  {
    path: "/welcome",
    element: <WelcomeView />
  },
  {
    path: "/games/:gameId/pregame",
    element: <PreGameView />,
    loader: pregameLoader,
    hydrateFallbackElement: <div className="loading-container"><span className="loading-indicator">Loading Game Data...</span></div>,
    errorElement: <ErrorPage />
  },
  {
      path: "/games/:gameId/game",
    element: <GameView />,
    loader: gameLoader,
    errorElement: <ErrorPage />
  },
  { path: "/error",
    element: <ErrorPage />
  },
  {
    path: "*",
    element: <Navigate to="/welcome" replace />
  }
]);

export default router;