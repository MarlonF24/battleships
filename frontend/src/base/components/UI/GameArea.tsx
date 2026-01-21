import styled from "styled-components";


const mobile = '@media (max-width: 800px)';

export const GameArea = styled.section.attrs({ className: 'game-area' })({
  display: "flex", 
  flexDirection: "column", 
  alignItems: "center",

  [mobile]: {
    gap: '20px', // Only keep what changes
  },
});
