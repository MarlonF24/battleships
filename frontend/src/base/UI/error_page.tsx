import React, { useEffect } from 'react';
import { useRouteError, isRouteErrorResponse, useLocation } from 'react-router-dom';
import { Page, useSwitchView } from '../../routing/switch_view';



export const ErrorPage: React.FC = () => {
    const switchView = useSwitchView();
    const location = useLocation();
    const error = useRouteError();

    let routeErrorMessage: string | null = null;
    if (error) {
        if (isRouteErrorResponse(error)) {
            routeErrorMessage = error.statusText || error.data?.message || "Unknown error";
        } else if (error instanceof Error) {
            routeErrorMessage = error.message;
        } else if (typeof error === 'string') {
            routeErrorMessage = error;
        } else {
            routeErrorMessage = 'An unexpected error has occurred.';
        }
    }

    const stateMessage = (location.state as { message?: string } | null)?.message;

    const errorMessage = stateMessage || routeErrorMessage || "An unexpected error has occurred.";
    
    const shouldRedirect = location.pathname !== '/error';
    
    useEffect(() => {
        if (shouldRedirect) {
            switchView(Page.ERROR, undefined, errorMessage);
        }
    }, []);

    
    if (shouldRedirect) {
        return null;
    }
    
    

    return (
        <div className="error-container">
            <h2 style={{color: 'var(--danger-color)'}}>Oops!</h2>
            <p>Sorry, an unexpected error has occurred.</p>
            <div className="error-message">
                <i>{errorMessage}</i>
            </div>
            <div className="button-bar">
                <button onClick={() => switchView(Page.BACK)} className="btn-danger">
                    Reload Previous Page
                </button>
                
                 <button onClick={() => switchView(Page.WELCOME)} className="btn-primary">
                    Go to Welcome
                </button>
                
            </div>
        </div>
    );
}
