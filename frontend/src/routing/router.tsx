
import { createBrowserRouter, LoaderFunction, Navigate, redirect } from "react-router-dom";
import { api, ResponseError, unpackErrorMessage, ErrorPage } from "../base";
import PreGameView, { PreGameViewLoaderData } from "../pregame/view.js";
import  WelcomeView  from "../welcome/view.js";
// import { GameView } from "../game/view.js";



const pregameLoader: LoaderFunction<PreGameViewLoaderData> = async ({ params }) => {
  const gameId = params.gameId!;
  const playerId = localStorage.getItem("playerId")!;
  
  try {
    const gameParams = await api.getPregameParamsGamesGameIdParamsGet({ gameId, playerId });
    return {gameParams, gameId};

  } catch (error) {
      if (error instanceof ResponseError) {
        const message = await unpackErrorMessage(error);
        switch (error.response.status) {
        case 404:
        case 403:
        case 422:
          console.error(`${message} Redirecting to welcome page.`);
          return redirect("/welcome");
        default:
          console.error(`Unexpected error: ${message}`);
          throw new Error(message); 
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
    loader: pregameLoader,
    hydrateFallbackElement: <div className="loading-container"><span className="loading-indicator">Loading Game Data...</span></div>,
    errorElement: <ErrorPage />
  },
  // {
    //   path: "/games/:gameId/game",
  //   element: <GameView />,
  //   loader: gameLoader,
  //   errorElement: <div>Error loading game!</div>  
  // }
]);

export default router;