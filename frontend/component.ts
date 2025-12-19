export abstract class Component {
    html!: HTMLElement;
    

    update_html(): void {
        this.html = this.render();
    }

    abstract render(): HTMLElement;
}