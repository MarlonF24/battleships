import { ShipDragger } from "./drag.js";
import { Component } from "../component.js";

export enum Orientation {
  HORIZONTAL = "horizontal",
  VERTICAL = "vertical",
}

export function toggle_orientation(current: string): string {
  return current === Orientation.HORIZONTAL
    ? Orientation.VERTICAL
    : Orientation.HORIZONTAL;
}

export class Ship extends Component {
  html!: HTMLElement;

  constructor(
    readonly length: number,
    public orientation = Orientation.HORIZONTAL
  ) {
    super();
    this.update_html();
  }

  rotate() {
    this.orientation === Orientation.HORIZONTAL
      ? (this.orientation = Orientation.VERTICAL)
      : (this.orientation = Orientation.HORIZONTAL);
    return this.orientation;
  }

  render(): HTMLElement {
    const el = document.createElement("div");
    el.className = "ship";
    el.style.boxSizing = "border-box";

    el.style.setProperty("--ship-length", this.length.toString());
    el.dataset.rotation = this.orientation;
    

    el.addEventListener("mousedown", new ShipDragger(el).mouseDownHandler);

    return el;
  }
}
