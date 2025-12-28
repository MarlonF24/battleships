import { setUpViewSwitchingListener } from "./view_switch/listener.js";
import { switchToView, AppPhase } from "./view_switch/types.js";
import "./main.css";

const BackendWebSocket = new WebSocket(`ws://${window.location.host}/ws`);


setUpViewSwitchingListener();

switchToView(AppPhase.PREGAME);