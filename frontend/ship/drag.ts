import { toggle_orientation } from "./ship.js";

// Interface for drag state
export interface DragState {
  originalElement: HTMLElement;
  clone: HTMLElement;
  lastX: number;
  lastY: number;
}

// Class encapsulating ship drag logic
export class ShipDragger {
  private state: DragState | null = null;

  constructor(private element: HTMLElement) {}

  public mouseDownHandler = (event: MouseEvent) => {
    if (event.button !== 0) return; // only left click

    const originalElement = this.element;
    const clone = originalElement.cloneNode(true) as HTMLElement;

    clone.classList.add("clone");
    // Set initial rotation angle to 0
    clone.style.setProperty("--rotation-angle", "0deg");

    originalElement.parentElement!.appendChild(clone);

    const original_styles = getComputedStyle(originalElement);
    clone.style.left = original_styles.left;
    clone.style.top = original_styles.top;

    originalElement.classList.add("dragged");
    this.state = {
      originalElement,
      clone,
      lastX: event.pageX,
      lastY: event.pageY,
    };

    this.element.addEventListener("dragstart", (e) => e.preventDefault());
    document.addEventListener("mousemove", this.onMouseMove);
    document.addEventListener("mouseup", this.onMouseUp);
    document.addEventListener("wheel", this.onWheel, { passive: false });
    document.addEventListener("contextmenu", this.onContextMenu);
  };

  private onMouseMove = (e: MouseEvent) => {
    if (!this.state) return;
    const { clone } = this.state;
    const computed_styles = getComputedStyle(clone);
    console.log("Current:", computed_styles.left, computed_styles.top);
    const shiftX = e.pageX - this.state.lastX;
    const shiftY = e.pageY - this.state.lastY;
    const currentLeft = parseInt(clone.style.left, 10);
    const currentTop = parseInt(clone.style.top, 10);
    clone.style.left = currentLeft + shiftX + "px";
    clone.style.top = currentTop + shiftY + "px";
    this.state.lastX = e.pageX;
    this.state.lastY = e.pageY;
  };

  private onMouseUp = (e: MouseEvent) => {
    if (!this.state) return;
    if (e.button === 2) return; // right click
    const { originalElement, clone } = this.state;
    document.removeEventListener("mousemove", this.onMouseMove);
    document.removeEventListener("mouseup", this.onMouseUp);
    document.removeEventListener("wheel", this.onWheel);
    document.removeEventListener("contextmenu", this.onContextMenu);
    clone.remove();
    originalElement.classList.remove("dragged");
    this.state = null;
  };

  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const clone = this.state!.clone;
    let angle = parseInt(clone.style.getPropertyValue("--rotation-angle"), 10);
    

    e.deltaY > 0 ? angle += 90 : angle -= 90;
    clone.dataset.rotation = toggle_orientation(clone.dataset.rotation!);

    clone.style.setProperty("--rotation-angle", `${angle}deg`);
  };

  private onContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    const clone = this.state!.clone;
    
    let angle = parseInt(clone.style.getPropertyValue("--rotation-angle"), 10);
    angle += 90;
    clone.dataset.rotation = toggle_orientation(clone.dataset.rotation!);
    clone.style.setProperty("--rotation-angle", `${angle}deg`);
  };
}
