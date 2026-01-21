import React from "react";
import { CreateGameButton } from "../../base";
import { JoinGameInput } from "./JoinGame";

import styled from "styled-components";

const WelcomeSection = styled.section.attrs({ className: "welcome-section" })({
    
    background: "var(--surface-color)",
    borderRadius: "12px",
    boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
    padding: "2rem 3rem",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "2rem",
});


const WelcomeHeader = styled.h2({
    marginBottom: "1rem",
    color: "var(--primary-color)",
    fontSize: "2rem",
    fontWeight: "700",
});


const WelcomeView: React.FC = () => {
    return (
    
        <WelcomeSection>
            <WelcomeHeader>Welcome to Battleships!</WelcomeHeader>
            <CreateGameButton />
            <JoinGameInput />
        </WelcomeSection>
    
 
    )
}

export default WelcomeView;
