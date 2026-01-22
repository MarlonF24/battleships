import { Page, useSwitchView } from "../../../routing/switch_view"
import { Button } from "./Button";

export const ToWelcomeButton = ({ style }: { style?: React.CSSProperties }) => {
    const switchView = useSwitchView();
    
    return (
        <Button $type="primary" onClick={() => switchView(Page.WELCOME)} style={style}>
                Back to Welcome
        </Button>
    )
}

