import { pregameView } from "./pregame/view.js";

const container: HTMLDivElement = document.getElementById(
	"main-flex"
) as HTMLDivElement;
container.style.position = "relative";

pregameView(container);