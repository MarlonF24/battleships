import { createPortal } from "react-dom";
import styled from "styled-components";

const PopupBackdrop = styled.div.attrs({className: 'popup-backdrop'})({
  position: "fixed",
  top: 0,
  left: 0,
  width: "100vw",
  height: "100vh",  
  
  background: "rgba(0, 0, 0, 0.5)",
 
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  
  zIndex: 1000
});

const PopupContent = styled.div.attrs({className: 'popup-content'})({
  background: "white",
  padding: "20px",
  borderRadius: "8px",
  boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",  
  
  position: "relative", 
  maxWidth: "90%",
  maxHeight: "90%",
  overflow: "auto",
});

export const Popup = ({ children, style }: { children: React.ReactNode, style?: React.CSSProperties }) => {
    // Safety check for SSR (Server Side Rendering) environments
    if (typeof document === 'undefined') return null;

    return createPortal(
        <PopupBackdrop>
            <PopupContent style={style}>
                {children}
            </PopupContent>
        </PopupBackdrop>,
        document.body
    );
};

