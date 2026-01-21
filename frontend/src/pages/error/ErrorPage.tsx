import React, { useEffect } from 'react';
import { useRouteError, isRouteErrorResponse, useLocation } from 'react-router-dom';
import { Page, useSwitchView } from '../../routing/switch_view';
import { ButtonBar, ErrorMessage, Button, ToWelcomeButton } from '../../base';

import styled from 'styled-components';


const ErrorContainer = styled.div.attrs({ className: "error-container" })({
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    minHeight: "200px",
    fontSize: "1.2rem",
    color: "var(--text-color)",
    flexDirection: "column",
    gap: "1rem",
})


const ErrorPage: React.FC = () => {
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
        <ErrorContainer>
            <h2 style={{color: 'var(--danger-color)'}}>Oops!</h2>
            <p>Sorry, an unexpected error has occurred.</p>
            <ErrorMessage errorMessage={errorMessage} />
            <ButtonBar>
                <Button $type="danger" onClick={() => switchView(Page.BACK)}>
                    Reload Previous Page
                </Button>
                
                <ToWelcomeButton />
                
            </ButtonBar>
        </ErrorContainer>
    );
}

export default ErrorPage;
