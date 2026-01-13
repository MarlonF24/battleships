import React from "react";
import { PregameButtonProps, ReadyButton, ResetButton, RandomButton } from "./buttons";

export const ButtonBar: React.FC<PregameButtonProps> = ({battleGrid, shipGarage}) => {
    return (
        <section id="pregame-button-bar" className="button-bar">
            <ReadyButton battleGrid={battleGrid} shipGarage={shipGarage} numReadyPlayers={0} />
            <ResetButton battleGrid={battleGrid} shipGarage={shipGarage} />
            <RandomButton battleGrid={battleGrid} shipGarage={shipGarage} />
        </section>
    );
}