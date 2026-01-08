import React from 'react';
import { useRouteError, isRouteErrorResponse, Link } from 'react-router-dom';


export const ErrorPage: React.FC = () => {
    const error = useRouteError();
    console.error("Route Error:", error);

    let errorMessage: string;

    if (isRouteErrorResponse(error)) {
        errorMessage = error.statusText || error.data?.message || "Unknown error";
    } else if (error instanceof Error) {
        errorMessage = error.message;
    } else if (typeof error === 'string') {
        errorMessage = error;
    } else {
        errorMessage = 'An unexpected error has occurred.';
    }

    return (
        <div className="error-container">
            <h2 style={{color: 'var(--danger-color)'}}>Oops!</h2>
            <p>Sorry, an unexpected error has occurred.</p>
            <div className="error-message">
                <i>{errorMessage}</i>
            </div>
            <div className="button-bar">
                <button onClick={() => window.location.reload()} className="btn-danger">
                    Reload Page
                </button>
                <Link to="/welcome">
                     <button className="btn-primary">Go to Welcome</button>
                </Link>
            </div>
        </div>
    );
}
