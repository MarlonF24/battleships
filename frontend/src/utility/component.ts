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

    constructor(protected text: string) {
        super();
        this.update_html();
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