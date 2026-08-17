/** Idempotent standalone seat claim presented in the retained loading style. */

import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AppShell } from "../components/app-shell";
import { Button, ErrorMessage } from "../components/ui";
import { joinMatch, localPath, standalonePlayerId } from "../lib/api";

/** Claim an open human seat once, then replace the route with its seat-token URL. */
export function JoinPage() {
  const { matchId = "" } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void joinMatch(matchId, { standalonePlayerId: standalonePlayerId() })
      .then(async (response) => {
        if (active)
          await navigate(localPath(response.playerUrl), { replace: true });
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(
            cause instanceof Error ? cause.message : "Could not join the game.",
          );
        }
      });
    return () => {
      active = false;
    };
  }, [matchId, navigate]);

  return (
    <AppShell>
      <section className="flex min-h-52 flex-col items-center justify-center gap-4 text-center">
        <h1 className="text-primary text-2xl font-bold">
          {error ? "Unable to join" : "Joining Game..."}
        </h1>
        {!error && (
          <p className="text-sm text-[#666] italic">Claiming your seat...</p>
        )}
        {error && <ErrorMessage message={error} />}
        {error && (
          <Button onClick={() => void navigate("/")}>Back to Home</Button>
        )}
      </section>
    </AppShell>
  );
}
