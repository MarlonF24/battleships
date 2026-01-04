import { AppPhase, useSwitchView } from "./switch_view.js";
import { ResponseError, unpackErrorMessage } from "../backend_api.js";
import { useApi } from "../utility/component.js";
import { createBrowserRouter, LoaderFunction, Navigate, redirect } from "react-router-dom";
import { api } from "../backend_api.js";
import PreGameView, { PreGameViewLoaderData } from "../pregame/view.js";
import  WelcomeView  from "../welcome/view.js";
// import { GameView } from "../game/view.js";

const PregameLoaderResponseErrorHandler = async (error: ResponseError, message: string) => {
  
}


const pregameLoader: LoaderFunction<PreGameViewLoaderData> = async ({ params }) => {
  const gameId = params.gameId!;
  const playerId = localStorage.getItem("playerId")!;
  
  try {
    const gameParams = await api.getPregameParamsGamesGamesGameIdParamsGet({ gameId, playerId });
    return { gameParams, gameId };
  } catch (error) {
      if (error instanceof ResponseError) {
        const message = await unpackErrorMessage(error);
        switch (error.response.status) {
        case 404:
        case 403:
        case 422:
          alert(`${message} Redirecting to welcome page.`);
          return redirect("/welcome");
        default:
          alert(`Unexpected error: ${message} Page will reload.`);
          window.location.reload();
          return null;
      }
    }
    throw error;
  }
}

const gameLoader: LoaderFunction = async ({ params }) => {
  const gameId  = params.gameId!;
  const playerId = localStorage.getItem("playerId")!;
  
  // return await api.getGameStateGamesGamesGameIdStateGet({ gameId, playerId });
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
    loader: pregameLoader  
  },
  // {
  //   path: "/games/:gameId/game",
  //   element: <GameView />,
  //   loader: gameLoader,
  //   errorElement: <div>Error loading game!</div>  
  // }
]);

export default router;