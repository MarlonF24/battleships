import { socketModels } from "../../base";
import { Popup, CreateGameForm, ToWelcomeButton, ButtonBar } from "../../base";
import styled from "styled-components";

const GameOverMessage = styled.div({
  textAlign: "center",
  fontSize: "1.5rem",
  fontWeight: "bold",
  marginBottom: "1rem",
});


export const GameOverPopup = ({ result}: { result: socketModels.GameOverResult}) => {
  return (
    <Popup>
        <GameOverMessage>
            {result === socketModels.GameOverResult.WIN && "Congratulations! You won!"}
            {result === socketModels.GameOverResult.LOSS && "Game Over! You lost."}
            {result === socketModels.GameOverResult.PREMATURE && "Game Ended Prematurely."}
        </GameOverMessage>
      <ButtonBar>
        <CreateGameForm />
        <ToWelcomeButton style={{ width: "fit-content", alignSelf: "center" }}/>
      </ButtonBar>
    </Popup>
)};
