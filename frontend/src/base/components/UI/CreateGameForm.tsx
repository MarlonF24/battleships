import React, { useState } from "react";
import styled from "styled-components";
import { useApi } from "../../hooks";
import { api, apiModels } from "../../api";
import { ErrorMessage } from "../ErrorMessage.tsx";
import { useSwitchView, Page } from "../../../routing/switch_view";
import { Button } from "./Button.tsx";

const FormContainer = styled.form.attrs({ className: "game-form-container" })({
  display: "flex",
  alignItems: "center",
  flexDirection: "column",
  gap: "1.5rem",
  marginBottom: "1rem",
});

const FieldSet = styled.div.attrs({ className: "game-form-fieldset" })({
  display: "flex",
  flexDirection: "column",
  gap: "0.5rem",
});

const Label = styled.label.attrs({ className: "game-form-label" })({
  fontWeight: "bold",
  fontSize: "0.9rem",
  color: "#555",
});

const SegmentedControl = styled.div.attrs({ className: "mode-selector" })({
  display: "flex",
  background: "#eee",
  padding: "4px",
  borderRadius: "8px",
  width: "fit-content",
  userSelect: "none",
});

const SegmentButton = styled.button.attrs({ className: "mode-button" })<{ $active: boolean }>(props => ({
  border: "none",
  padding: "8px 16px",
  borderRadius: "6px",
  cursor: "pointer",
  backgroundColor: props.$active ? "white" : "transparent",
  boxShadow: props.$active ? "0 2px 4px rgba(0,0,0,0.1)" : "none",
  fontWeight: props.$active ? "600" : "400",
  transition: "background-color 0.2s ease, box-shadow 0.2s ease",
  "&:hover": {
    backgroundColor: props.$active ? "white" : "#e0e0e0",
  },
}));

const ExplanationWrapper = styled.div({
  position: "relative",
  marginTop: "4px",
  minHeight: "1.5rem",
});

const GhostText = styled.p({
  fontSize: "0.85rem",
  fontStyle: "italic",
  margin: 0,
  visibility: "hidden",
  whiteSpace: "nowrap",
});

const ExplanationText = styled.p.attrs({ className: "mode-explanation" })({
  fontSize: "0.85rem",
  color: "#666",
  fontStyle: "italic",
  margin: 0,
  position: "absolute",
  top: 0,
  left: 0,
  width: "100%",
});

const ModeExplanationMap: Record<apiModels.GameMode, string> = {
  [apiModels.GameMode.Singleshot]: "Players take one shot each turn.",
  [apiModels.GameMode.Salvo]: "Players fire three shots each turn.",
  [apiModels.GameMode.Streak]: "Players fire consecutive shots until they miss.",
};

export const CreateGameForm: React.FC = () => {
  const { loading, error, executeApi } = useApi();
  const switchView = useSwitchView();
  const [selectedMode, setSelectedMode] = useState<apiModels.GameMode>(apiModels.GameMode.Singleshot);

  const longestExplanation = Object.values(ModeExplanationMap).reduce(
    (a, b) => (a.length > b.length ? a : b),
    ""
  );

  const submitHandler = (event: React.FormEvent) => {
    event.preventDefault();
    executeApi(async () => {
      const playerId = sessionStorage.getItem("playerId")!;
      const battleGridRows: number = 10;
      const battleGridCols: number = 10;
      const shipLengths: Map<number, number> = new Map([[3, 1]]);

      const gameId = await api.createGameGamesCreatePost({
        playerId,
        pregameParams: {
          battleGridRows,
          battleGridCols,
          shipLengths: Object.fromEntries(shipLengths),
          mode: selectedMode,
        },
      });

      console.log(`Game created with ID: ${gameId}`);
      switchView(Page.PREGAME, gameId);
    });
  };

  return (
    <FormContainer onSubmit={submitHandler} >
      <FieldSet>
        <Label>Turn Rules</Label>
        <SegmentedControl>
          {Object.values(apiModels.GameMode).map((mode) => (
            <SegmentButton
              key={mode}
              type="button"
              $active={selectedMode === mode}
              onClick={() => setSelectedMode(mode)}
            >
              {mode}
            </SegmentButton>
          ))}
        </SegmentedControl>
        
        <ExplanationWrapper>
          <GhostText aria-hidden="true">{longestExplanation}</GhostText>
          <ExplanationText>{ModeExplanationMap[selectedMode]}</ExplanationText>
        </ExplanationWrapper>
      </FieldSet>

      <Button 
        $type="primary" 
        type="submit" 
        disabled={loading} 
        style={{ width: "fit-content", alignSelf: "center" }}
      >
        {loading ? "Creating..." : "Create Game"}
      </Button>
      
      {error && <ErrorMessage errorMessage={`Error: ${error}`} />}
    </FormContainer>
  );
};