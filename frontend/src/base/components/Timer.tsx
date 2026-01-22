import { useEffect, useState, useMemo } from "react";
import styled from "styled-components";

const StyledTimer = styled.div({
  fontSize: "1.5rem",
  fontWeight: "bold",
  color: "#333",
  textAlign: "center",
  padding: "10px",
  border: "2px solid #ccc",
  borderRadius: "8px",
  backgroundColor: "#f9f9f9",
  width: "max-content", // Ensures text doesn't wrap
 
});

export const Timer = ({ initialSeconds, onExpire, style }: { initialSeconds: number; onExpire: () => void, style?: React.CSSProperties }) => {
  const endTime = useMemo(() => {
    const saved = localStorage.getItem("timer_end");
    if (saved) return parseInt(saved);

    const target = Date.now() + initialSeconds * 1000;
    localStorage.setItem("timer_end", target.toString());
    
    return target;
  }, [initialSeconds]);

  const [timeLeft, setTimeLeft] = useState(() => Math.max(0, Math.ceil((endTime - Date.now()) / 1000)));

  useEffect(() => {
    return () => {
      localStorage.removeItem("timer_end");
    };
  }, []);

  useEffect(() => {
    if (timeLeft <= 0) {
      localStorage.removeItem("timer_end");
      onExpire();
      return;
    }

    const timer = setTimeout(() => {
      setTimeLeft(Math.max(0, Math.ceil((endTime - Date.now()) / 1000)));
    }, 1000);

    return () => clearTimeout(timer);
  }, [timeLeft, endTime, onExpire]);

  return (
    <StyledTimer style={style}>
      {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, "0")}
    </StyledTimer>
  );
};