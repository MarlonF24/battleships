import { Page, useSwitchView } from "../../../routing/switch_view"
import { Button } from "./Button";

const ToWelcomeButton = () => {
    const switchView = useSwitchView();
    
    return (
        <Button $type="primary" onClick={() => switchView(Page.WELCOME)}>
                Back to Welcome Page
        </Button>
    )
}

export default ToWelcomeButton;