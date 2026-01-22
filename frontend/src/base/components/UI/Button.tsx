import styled from "styled-components";

export const Button = styled.button<{ $type?: 'primary' | 'danger' | 'success' }>(props => ({
  color: "#fff",
  border: "none",
  borderRadius: "4px",
  padding: "8px 16px",
  fontWeight: "bold",
  cursor: "pointer",
  transition: "background 0.2s",
  fontSize: "1rem",
  background: `var(--${props.$type || 'primary'}-color)`,

  "&:hover": {
    background: `var(--${props.$type || 'primary'}-color-hover)`,
  },

  "&:active": {
    transform: "translateY(1px)",
  }
}));

export const ButtonBar = styled.div.attrs({ className: 'button-bar' })<{ $vertical?: boolean }>(props => ({
  display: "flex",
  flexDirection: props.$vertical ? "column" : "row",
  gap: "16px",
  marginBottom: "24px",
  flexWrap: "wrap",
  justifyContent: "center",
  alignItems: props.$vertical ? "center" : "initial",

  "& > button": {
    flex: "0 1 auto",
    width: props.$vertical ? "100%" : "auto",
  }
}));