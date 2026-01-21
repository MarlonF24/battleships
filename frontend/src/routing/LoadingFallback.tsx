import styled from 'styled-components';

const LoadingContainer = styled.div.attrs({ className: 'loading-container' })({
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  alignItems: "center",
  minHeight: "200px",
  fontSize: "1.2rem",
  color: "var(--text-color)",
  gap: "1rem"
});

const LoadingIndicator = styled.i.attrs({ className: 'loading-indicator' })({
  color: "var(--primary-color)",
  fontStyle: "italic",
  fontSize: "0.9rem",
  display: "flex",
  alignItems: "center",
  gap: "0.5rem",
  margin: "0.5rem 0"
});

export const LoadingFallback = ({ message = "Loading Game Data..." }: { message?: string }) => (
  <LoadingContainer>
    <LoadingIndicator>{message}</LoadingIndicator>
  </LoadingContainer>
);