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
    length: number,
    orientation: Orientation = Orientation.HORIZONTAL
  ) {
    super();
    this.update_html();
    this.length = length;
    this.orientation = orientation;
  }

  get length(): number {
      return parseInt(this.html.style.getPropertyValue("--ship-length"), 10);
  }

  set length(value: number) {
    if (this.html.style.getPropertyValue("--ship-length")) throw new Error("Length is already set and cannot be changed.");
    this.html.style.setProperty("--ship-length", value.toString());
  }

  get orientation(): Orientation {
    return this.html.dataset.rotation as Orientation;
  }

  set orientation(value: Orientation) {
    this.html.dataset.rotation = value;
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
    
    el.dataset.rotation = el.dataset.rotation ?? Orientation.HORIZONTAL;
    

    el.addEventListener("mousedown", new ShipDragger(el).mouseDownHandler);

    return el;
  }
}
