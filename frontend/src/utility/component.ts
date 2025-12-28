export abstract class Component {
    html!: HTMLElement;
    

    update_html(): void {
        this.html = this.render();
    }

    abstract render(): HTMLElement;
}

export abstract class Button extends Component {
    declare html: HTMLButtonElement;

    abstract clickHandler(e: MouseEvent): void;

    constructor(protected text: string) {
        super();
        this.update_html();
    }

    render(): HTMLButtonElement {
        const button = document.createElement("button");
        button.textContent = this.text;
        let className = this.constructor.name;
        className = className.charAt(0).toLowerCase() + className.slice(1);
        button.className = className;
        button.addEventListener("click", (e) => this.clickHandler(e));
        return button;
    }
}