import { Component } from "../utility/component";

export class JoinGameInput extends Component {
    declare html: HTMLF;

    constructor() {
        super();
        this.update_html();
    }

    render(): HTMLFormElement {
        const form = document.createElement("form");
        form.id = "join-game-form";
        form.action

        const input = document.createElement("input");
        input.type = "text";
        input.id = "game-id-input";
        input.name = "gameId";
        input.placeholder = "Enter Game ID";

        const label = document.createElement("label");
        label.htmlFor = "game-id-input";
        label.innerText = "Game ID:";

        const submitButton = document.createElement("button");
        submitButton.type = "submit";
        submitButton.innerText = "Join Game";

        form.appendChild(label);
        form.appendChild(input);
        form.appendChild(submitButton);
        return form;
    }
}
