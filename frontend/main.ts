import { pregameView } from "./pregame/view.js";

const mainFlex: HTMLDivElement = document.getElementById(
	"main-flex"
) as HTMLDivElement;

const buttonsFlex: HTMLDivElement = document.getElementById(
	"buttons"
) as HTMLDivElement;

pregameView(mainFlex, buttonsFlex);