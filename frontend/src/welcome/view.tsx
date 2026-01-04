import React from "react";
import { CreateGameButton } from "./buttons/buttons";
import { JoinGameInput } from "./inputs/inputs";

import "./welcome.css";

const WelcomeView: React.FC = () => {
    return (
    <>
        <section id="welcome-section" className="welcome-section">
            <h2>Welcome to Battleships!</h2>
            <CreateGameButton />
            <JoinGameInput />
        </section>
    
    </>
    )
}

export default WelcomeView;
