/** Browser route table with local error boundaries and trusted role links. */

import { createBrowserRouter } from "react-router-dom";
import { GamePage } from "./pages/game-page";
import { JoinPage } from "./pages/join-page";
import { RouteErrorPage } from "./pages/route-error";
import { WelcomePage } from "./pages/welcome-page";

/** Browser route table; each failure remains within the route error boundary. */
export const router = createBrowserRouter([
  {
    path: "/",
    element: <WelcomePage />,
    errorElement: <RouteErrorPage />,
  },
  {
    path: "/join/:matchId",
    element: <JoinPage />,
    errorElement: <RouteErrorPage />,
  },
  {
    path: "/matches/:matchId/player/:seatToken",
    element: <GamePage sessionRole="player" />,
    errorElement: <RouteErrorPage />,
  },
  {
    path: "/spectate/:matchId",
    element: <GamePage sessionRole="spectator" />,
    errorElement: <RouteErrorPage />,
  },
]);
