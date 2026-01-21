import { useSwitchView, Page } from "../../routing/switch_view";
import { useApi, api, ErrorMessage, Button } from "../../base";

import styled from 'styled-components';

const StyledJoinGameForm = styled.form.attrs({ className: "join-game-form" })({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "0.75rem",
  marginTop: "1rem",

  "label": {
    fontSize: "1rem",
    color: "var(--text-color, #333)",
    fontWeight: 500,
  },
});

export const GameInput = styled.input({
  padding: "0.5rem",
  border: "1px solid #ccc",
  borderRadius: "4px",
  fontSize: "1rem",
  width: "200px",
  textAlign: "center",
  transition: "border-color 0.2s, box-shadow 0.2s",
  outline: "none",

  "&:focus": {
    borderColor: "var(--primary-color, #007bff)",
    boxShadow: "0 0 0 2px rgba(0, 123, 255, 0.25)",
  },

  "&:disabled": {
    backgroundColor: "#f5f5f5",
    cursor: "not-allowed",
  },
});


export const JoinGameInput: React.FC = () => {
  const { loading, error, executeApi } = useApi();
  const switchView = useSwitchView();

  const dispatchJoin = (event: React.FormEvent) => executeApi(async () => {
    event.preventDefault();
    const formData = new FormData(event.target as HTMLFormElement);
    const gameId = formData.get("gameId")?.toString();

    if (!gameId) return;

    const playerId = sessionStorage.getItem("playerId")!;
    await api.joinGameGamesGameIdJoinPost({ gameId, playerId });
    switchView(Page.PREGAME, gameId);
  });

  return (
    <StyledJoinGameForm onSubmit={dispatchJoin}>
      {error && <ErrorMessage errorMessage={error} />}
      
      <label htmlFor="game-id-input">Join an existing game:</label>
      
      <GameInput type="text" name="gameId" id="game-id-input" placeholder="Enter Game ID" required disabled={loading}/>

      <Button $type="success" type="submit" disabled={loading}>
        {loading ? "Joining..." : "Join Game"}
      </Button>
    </StyledJoinGameForm>
  );
};

