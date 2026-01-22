import styled from "styled-components";


const StyledErrorMessage = styled.div.attrs({className: 'error-message'})({
    color: "var(--danger-color)",   
    background: "#ffebee",
    border: "1px solid var(--danger-color)",
    borderRadius: "4px",
    padding: "0.75rem 1rem",
    fontSize: "0.9rem",
    margin: "0.5rem 0",
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    width: "fit-content",
})


export const ErrorMessage = ({errorMessage}: {errorMessage: string}) => {
    return (
        <StyledErrorMessage>
            <i>{errorMessage}</i>
        </StyledErrorMessage>
    );
}