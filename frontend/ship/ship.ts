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
    private orientation: Orientation = Orientation.HORIZONTAL
  ) {
    super();
    this.update_html();
  }

  getOrientation(): Orientation {
    return this.orientation;
  }

  setOrientation(orientation: Orientation) {
    this.orientation = orientation;
    this.html.dataset.orientation = orientation;
  }

  rotate() {
    this.setOrientation(toggle_orientation(this.orientation) as Orientation);
  }

  render(): HTMLElement {
    const el = document.createElement("div");
    el.className = "ship";

    el.dataset.orientation = this.orientation;
    el.style.setProperty("--ship-length", this.length.toString());

    el.addEventListener("mousedown", new Dragger(this).mouseDownHandler);

    return el;
  }
}

// Interface for drag state
interface DragState {
  originalShip: Ship;
  clone: Ship;
  lastX: number;
  lastY: number;
  currentCell?: HTMLElement;
}

// Class encapsulating ship drag logic
class Dragger {
  private state!: DragState;

  constructor(private ship: Ship) {}

  public mouseDownHandler = (event: MouseEvent) => {
    if (event.button !== 0) return; // only left click

    const originalHTML = this.ship.html;

    const clone = new Ship(this.ship.length, this.ship.getOrientation());
    const cloneHTML = clone.html;
    cloneHTML.classList.add("clone");

    // Set initial orientation angle to 0
    cloneHTML.style.setProperty("--rotation-angle", "0deg");

    originalHTML.parentElement!.appendChild(cloneHTML);

    const original_styles = getComputedStyle(originalHTML);
    cloneHTML.style.left = original_styles.left;
    cloneHTML.style.top = original_styles.top;
    cloneHTML.style.width = original_styles.getPropertyValue("width");
    cloneHTML.style.height = original_styles.getPropertyValue("height");

    originalHTML.classList.add("dragged");
    originalHTML.style.pointerEvents = "none";

    this.state = {
      originalShip: this.ship,
      clone: clone,
      lastX: event.pageX,
      lastY: event.pageY,
    };

    originalHTML.addEventListener("dragstart", (e) => e.preventDefault());
    cloneHTML.addEventListener("dragstart", (e) => e.preventDefault());
    document.addEventListener("mousemove", this.onMouseMove);
    document.addEventListener("mouseup", this.onMouseUp);
    document.addEventListener("wheel", this.onWheel, { passive: false });
    document.addEventListener("contextmenu", this.onContextMenu);

    document.body.style.cursor = "grabbing";

    this.dispatchMouseOver();
    
  };

  private onMouseMove = (e: MouseEvent) => {
    const clone = this.state.clone;

    // Calculate the shift
    const shiftX = e.pageX - this.state.lastX;
    const shiftY = e.pageY - this.state.lastY;

    // Get current position
    const currentLeft = parseInt(clone.html.style.left, 10);
    const currentTop = parseInt(clone.html.style.top, 10);

    // Update the position of the clone
    clone.html.style.left = currentLeft + shiftX + "px";
    clone.html.style.top = currentTop + shiftY + "px";

    // Update last positions
    this.state.lastX = e.pageX;
    this.state.lastY = e.pageY;

    this.dispatchMouseOver();
  };

  private dispatchMouseOver() {
    let boundingRect = this.state.clone.html.getBoundingClientRect();

    let cloneCenter = {
      x: boundingRect.left + boundingRect.width / 2,
      y: boundingRect.top + boundingRect.height / 2,
    };

    // Determine the element under the cursor
    const elementsBelow = document.elementsFromPoint(
      cloneCenter.x,
      cloneCenter.y
    );
    const cell = Array.from(elementsBelow).find((el) =>
      el.classList.contains("cell")
    ) as HTMLElement | undefined;

    if (cell && cell !== this.state.currentCell) {
      this.state.currentCell?.dispatchEvent(
        new CustomEvent("ship-out", {
          bubbles: false,
        })
      );

      cell.dispatchEvent(
        new CustomEvent("ship-over", {
          detail: {
            ship_clone: this.state.clone,
            original_ship: this.state.originalShip,
          },
          bubbles: false,
        })
      );
      this.state.currentCell = cell;
    } else if (!cell) {
      this.state.currentCell?.dispatchEvent(
        new CustomEvent("ship-out", {
          bubbles: false,
        })
      );
      this.state.currentCell = undefined;
    }
  }

  private onMouseUp = (e: MouseEvent) => {
    if (e.button === 2) return; // right click

    const { originalShip, clone } = this.state;

    // Clean up event listeners
    document.removeEventListener("mousemove", this.onMouseMove);
    document.removeEventListener("mouseup", this.onMouseUp);
    document.removeEventListener("wheel", this.onWheel);
    document.removeEventListener("contextmenu", this.onContextMenu);

    clone.html.remove();

    if (this.state.currentCell) {
      this.state.currentCell.dispatchEvent(
        new CustomEvent("ship-placed", {
          bubbles: false,
        })
      );
      
    } else {
    
      originalShip.html.classList.remove("dragged");
      originalShip.html.style.pointerEvents = "auto";
    
    }
    
    
    document.body.style.cursor = "default";
  };

  private onWheel = (e: WheelEvent) => {
    e.preventDefault(); // prevent page scrolling
    const clone = this.state!.clone;
    let angle = parseInt(
      clone.html.style.getPropertyValue("--rotation-angle"),
      10
    );

    if (!this.state.currentCell) console.log("No current cell on wheel event"); 

    e.deltaY > 0 ? (angle += 90) : (angle -= 90);

    clone.rotate();

    clone.html.style.setProperty("--rotation-angle", `${angle}deg`);
    this.state.currentCell?.dispatchEvent(
      new CustomEvent("ship-rotate", {
        bubbles: false,
      })
    );
  };

  private onContextMenu = (e: MouseEvent) => {
    e.preventDefault(); // prevent context menu
    const clone = this.state!.clone;

    let angle = parseInt(
      clone.html.style.getPropertyValue("--rotation-angle"),
      10
    );

    angle += 90;

    clone.rotate();
    clone.html.style.setProperty("--rotation-angle", `${angle}deg`);
    this.state.currentCell?.dispatchEvent(
      new CustomEvent("ship-rotate", {
        bubbles: false,
      })
    );
  };
}

// function reset_rotation(clone: HTMLElement, angle: number) {
//   if (!(angle % 360 == 0)) return;

//   let transition_style = getComputedStyle(clone).transition;
//   console.log(clone.style.transition);

//   let match = transition_style.match(/transform ([0-9]+(\.[0-9]+)?)s/);
//   if (!match) throw new Error("No transform transition found.");
//   let duration = parseFloat(match[1]);
//   console.log("Duration:", duration);

//   setTimeout(() => {

//   }, 1 + duration * 1000);

//   clone.style.setProperty("transition", transition_style.replace(/transform [0-9]+(\.[0-9]+)?s/, 'transform 0s'));

//   void clone.offsetWidth; // force reflow

//   clone.style.setProperty("--rotation-angle", `0deg`);

//   setTimeout(() => {
//     clone.style.setProperty("transition", transition_style);
//   }, 0);
// }
