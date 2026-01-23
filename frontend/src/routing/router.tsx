import { createBrowserRouter, LoaderFunction, Navigate } from "react-router-dom";
import { api, ResponseError, unpackErrorMessage, getPlayerId } from "../base";
import PreGameView, { GameViewLoaderData } from "../pages/pregame";
import  WelcomeView  from "../pages/welcome";
import GameView from "../pages/game";
import ErrorPage from "../pages/error";
import { LoadingFallback } from "./LoadingFallback";

const paramsLoader: LoaderFunction<GameViewLoaderData> = async ({ params }) => {
  const gameId = params.gameId!;
  const playerId = getPlayerId()!;
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
    loader: paramsLoader,
    hydrateFallbackElement: <LoadingFallback />,
    errorElement: <ErrorPage />
  },
  {
      path: "/games/:gameId/game",
    element: <GameView />,
    loader: paramsLoader,
    hydrateFallbackElement: <LoadingFallback />,
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