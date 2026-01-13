import React, {useState} from "react";

import "./copy_button.css";

export const CopyButton: React.FC<{text: string}> = ({text}) => {
  const [copied, setCopied] = useState(false);  
  
  const copyToClipboard = async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 150);
    };
    
    return <button onClick={copyToClipboard} className="copy-button" data-copied={copied}>⧉</button>;
};

