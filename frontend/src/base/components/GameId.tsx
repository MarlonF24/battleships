import React from "react";
import { CopyButton } from "./UI/CopyButton";
import styled from "styled-components";


const GameIdSection = styled.section.attrs({className: 'game-id'})({
  fontSize: "1.2rem",
  fontWeight: 600,
  color: "var(--primary-color)",
  background: "var(--surface-color)",
  borderRadius: "6px",  
  padding: "0.5rem 1.5rem",
  margin: "1rem auto 1.5rem auto",
  textAlign: "center",
  boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
  maxWidth: "400px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "0.5em",
});

export const GameId : React.FC<{ gameId: string }> = ({ gameId }) => {
    return (
        <GameIdSection>
            <span>{`Game ID: ${gameId}`}</span>
            <CopyButton text={gameId}/>
        </GameIdSection>
    );
};
