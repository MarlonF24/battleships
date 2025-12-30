import "./component.css";

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

    constructor(protected text: string, initialiseHTML: boolean = true) {
        super();
        if (initialiseHTML) {
            this.update_html();
        }
    }

    render(): HTMLButtonElement {
        const button = document.createElement("button");
        button.textContent = this.text;
        let id = this.constructor.name;
        id = id.charAt(0).toLowerCase() + id.slice(1);
        button.id = id;
        button.addEventListener("click", (e) => this.clickHandler(e));
        return button;
    }
}


export class CopyButton<T extends HTMLElement> extends Button {
    constructor(private elementToCopy: T, private getTextFromElement: (el: T) => string) {
        super("⧉", false);
        this.elementToCopy = elementToCopy;
        this.getTextFromElement = getTextFromElement;
        this.update_html();
    }

    clickHandler = () => {
        let text = this.getTextFromElement(this.elementToCopy);
        navigator.clipboard.writeText(text);
        
        this.html.classList.add("copied");
        setTimeout(() => {
            this.html.classList.remove("copied");
        }, 120);
    }

    render(): HTMLButtonElement {
        const button = super.render();
        button.classList.add("copy-button");
        button.title = "Copy to clipboard";

        return button;
    }

}



export enum TooltipPosition {
    TOP,
    BOTTOM,
    LEFT,
    RIGHT
}

export class Tooltip extends Component {
    declare html: HTMLSpanElement;
    constructor(private text: string, private position: TooltipPosition = TooltipPosition.TOP) {
        super();
        this.update_html();
    }

    render(): HTMLSpanElement {
        const tooltip = document.createElement("span");
        tooltip.className = "tooltip";
        tooltip.textContent = this.text;
        tooltip.dataset.position = TooltipPosition[this.position].toLowerCase();
        return tooltip;
    }
}