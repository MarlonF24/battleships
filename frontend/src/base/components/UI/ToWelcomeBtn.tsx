import { Page, useSwitchView } from "../../../routing/switch_view"

const ToWelcomeBtn = () => {
    const switchView = useSwitchView();
    
    return (
        <button onClick={() => switchView(Page.BACK)} className="btn-danger">
                Reload Previous Page
        </button>
    )
}

export default ToWelcomeBtn;