import React from "react";


import styled from "styled-components";

const StyledCopyButton = styled.button.attrs({ className: "copy-button" })({
    
	background: "none",
	border: "none",
	color: "var(--primary-color)",
	fontSize: "1.2em",
	cursor: "pointer",
	padding: "0.25em 0.6em",
	borderRadius: "4px",
	transition: "background 0.12s, color 0.12s",
	overflow: "hidden",
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
	lineHeight: 1,
	verticalAlign: "middle",
	fontWeight: "bold",


    "&:hover": {
        background: "#e3eaf6",
    },


    "&:active": {
	background: "var(--primary-color)",
	color: "#fff",
    }
})



export const CopyButton: React.FC<{text: string}> = ({text}) => {
  
  const copyToClipboard = async () => {
        await navigator.clipboard.writeText(text);
    };
    
    return <StyledCopyButton onClick={copyToClipboard}>⧉</StyledCopyButton>;
};

