import React from "react";
import { ButtonBar } from "../../../base";
import { PregameButtonProps, ReadyButton, ResetButton, RandomButton } from "./buttons";

export const PregameButtonBar: React.FC<PregameButtonProps> = ({battleGrid, shipGarage}) => {
    return (
        <ButtonBar>
            <ReadyButton battleGrid={battleGrid} shipGarage={shipGarage} numReadyPlayers={0} />
            <ResetButton battleGrid={battleGrid} shipGarage={shipGarage} />
            <RandomButton battleGrid={battleGrid} shipGarage={shipGarage} />
        </ButtonBar>
    );
}