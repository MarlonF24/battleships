import React, {useState} from "react";

import "./copy_button.css";

export const CopyButton: React.FC<{text: string}> = ({text}) => {
  
  const copyToClipboard = async () => {
        await navigator.clipboard.writeText(text);
    };
    
    return <button onClick={copyToClipboard} className="copy-button">⧉</button>;
};

