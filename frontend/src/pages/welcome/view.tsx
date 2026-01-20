import React from "react";
import { CreateGameButton } from "../../base";
import { JoinGameInput } from "./JoinGame/JoinGame";

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
