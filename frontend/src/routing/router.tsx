
import { createBrowserRouter, LoaderFunction, Navigate, redirect, useRouteError } from "react-router-dom";
import { api, ResponseError, unpackErrorMessage, ErrorPage } from "../base/index.js";
import PreGameView, { PreGameViewLoaderData } from "../pregame/view.js";
import  WelcomeView  from "../welcome/view.js";
import GameView, {GameViewLoaderData} from "../game/view.js";



const pregameLoader: LoaderFunction<PreGameViewLoaderData> = async ({ params }) => {
  const gameId = params.gameId!;
  const playerId = sessionStorage.getItem("playerId")!;
  try {
    const preGameParams = await api.getPregameParamsGamesGameIdPregameParamsGet({ gameId, playerId });
    return {preGameParams, gameId};
  } catch (err) {
    if (err instanceof ResponseError) {
      const errorMessage = await unpackErrorMessage(err);
      throw new Error(errorMessage);
    }
    throw err;
  }
}

const gameLoader: LoaderFunction<GameViewLoaderData> = async ({ params }) => {
  const gameId  = params.gameId!;
  const playerId = sessionStorage.getItem("playerId")!;
  
  const gameState = await api.getGameParamsGamesGamesGameIdGameParamsGet({ gameId, playerId });
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