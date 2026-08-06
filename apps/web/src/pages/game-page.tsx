/** Role-aware live route with projection-only rendering and legacy states. */

import { useEffect, useState } from "react";
import { observer } from "mobx-react-lite";
import { Navigate, useParams } from "react-router-dom";
import { AppShell } from "../components/app-shell";
import { BattleView } from "../components/battle-view";
import { CompletionDialog } from "../components/completion-dialog";
import { MatchHeader } from "../components/match-header";
import { PlacementView } from "../components/placement-view";
import { ErrorMessage } from "../components/ui";
import {
  MatchSessionStore,
  type SessionIdentity,
} from "../stores/match-session-store";
import { PlacementDraftStore } from "../stores/placement-draft-store";

type GamePageProps = Readonly<{ sessionRole: "player" | "spectator" }>;

/** Own route-scoped session stores and select a view from server phase state. */
export const GamePage = observer(function GamePage({
  sessionRole,
}: GamePageProps) {
  const params = useParams();
  const matchId = params.matchId ?? "";
  const seatToken = sessionRole === "player" ? params.seatToken : undefined;
  const [session] = useState(() => {
    const identity: SessionIdentity =
      sessionRole === "player"
        ? { role: sessionRole, matchId, seatToken: seatToken ?? "" }
        : { role: sessionRole, matchId };
    return new MatchSessionStore(identity);
  });
  const [draft] = useState(() => new PlacementDraftStore());

  useEffect(() => {
    session.connect();
    return () => session.dispose();
  }, [session]);

  if (!matchId || (sessionRole === "player" && !seatToken)) {
    return <Navigate to="/" replace />;
  }

  const unavailable = !session.projection && session.socketState === "closed";
  const unavailableMessage =
    sessionRole === "spectator"
      ? "This match is no longer available. Live and completed boards are intentionally not retained after the in-memory session ends."
      : "This player link is invalid or the live match is no longer available.";

  return (
    <AppShell gameLayout>
      {!session.projection ? (
        <section className="flex min-h-52 max-w-xl flex-col items-center justify-center gap-4 text-center">
          <h1 className="text-primary text-2xl font-bold">
            {unavailable ? "Match unavailable" : "Loading Game Data..."}
          </h1>
          <p className="text-sm text-[#666] italic">
            {unavailable
              ? unavailableMessage
              : "Connecting to the game server..."}
          </p>
          {session.rejection && <ErrorMessage message={session.rejection} />}
        </section>
      ) : (
        <>
          <MatchHeader projection={session.projection} store={session} />
          {session.rejection && <ErrorMessage message={session.rejection} />}
          {session.socketState === "reconnecting" && (
            <p className="mb-4 text-center text-[#666] italic">
              Connection lost. Reconnecting...
            </p>
          )}
          {session.projection.phase === "placement" ? (
            <PlacementView
              projection={session.projection}
              session={session}
              draft={draft}
            />
          ) : (
            <BattleView projection={session.projection} session={session} />
          )}
          {session.projection.phase === "completed" && (
            <CompletionDialog projection={session.projection} />
          )}
        </>
      )}
    </AppShell>
  );
});
