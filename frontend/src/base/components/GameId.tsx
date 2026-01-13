import React from "react";
import { CopyButton } from "./UI/copy_button/copy_button";



const myStyle: React.CSSProperties = {
  fontSize: "1.2rem",
  fontWeight: 600,
  color: "var(--primary-color)",
  background: "var(--bg-color)",
  borderRadius: "6px",  
  padding: "0.5rem 1.5rem",
  margin: "1rem auto 1.5rem auto",
  textAlign: "center",
  boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
  maxWidth: "400px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "0.5em",
};

export const GameId : React.FC<{ gameId: string }> = ({ gameId }) => {
    return (
        <section className="game-id" style={myStyle}>
            <span>{`Game ID: ${gameId}`}</span>
            <CopyButton text={gameId}/>
        </section>
    );
};
