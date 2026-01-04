import React, { useState } from "react";
import { ResponseError, unpackErrorMessage } from "../backend_api.js";

import "./component.css";



export const CopyButton: React.FC<{text: string}> = ({text}) => {
    const copyToClipboard = async () => {
        await navigator.clipboard.writeText(text);
    };
    
    return <button onClick={copyToClipboard} className="copy-button">⧉</button>;
};


export enum TooltipPosition {
    TOP,
    BOTTOM,
    LEFT,
    RIGHT
}

export const Tooltip: React.FC<{text: string, position: TooltipPosition}> = ({text, position}) => {
    return (
        <span className="tooltip" data-position={TooltipPosition[position].toLowerCase()}>
            {text}
        </span>
    );
};


export const useAsync = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function execute<T>(asyncFn: () => Promise<T>): Promise<T> {
        setLoading(true);
        setError(null);
        try {
            return await asyncFn();
        } catch (err) {
            setError(err instanceof Error ? err.message : "An unknown error occurred");
            console.error("Error in useAsync:", err);
            throw err;
        } finally {
            setLoading(false);
        }
    };

    return { loading, error, execute };
}



function defaultResponseErrorHandler(error: ResponseError, message: string) {
    throw new Error(`API Error: ${message}`);
}


export const useApi = (responseErrorHandler: (error: ResponseError, message: string) => void = defaultResponseErrorHandler) => {
  const { loading, error, execute } = useAsync(); 
  
  async function executeApi<T>(apiCall: () => Promise<T>): Promise<T> {
    return execute(async () => {
      try {
        return await apiCall();
      } catch (error) {
        if (error instanceof ResponseError) {
          const message = await unpackErrorMessage(error);
          responseErrorHandler(error, message);
        }
        throw error; // Re-throw for useAsync to handle
      }
    });
  };
  
  return { loading, error, executeApi };
};