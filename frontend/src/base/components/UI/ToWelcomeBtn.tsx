import { Page, useSwitchView } from "../../../routing/switch_view"

const ToWelcomeBtn = () => {
    const switchView = useSwitchView();
    
    return (
        <button onClick={() => switchView(Page.WELCOME)} className="btn-primary">
                Back to Welcome Page
        </button>
    )
}

export default ToWelcomeBtn;