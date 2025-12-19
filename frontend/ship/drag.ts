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
    clone.style.pointerEvents = "none";
    clone.style.zIndex = "1000";
    originalElement.parentElement!.appendChild(clone);
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
    const shiftX = e.pageX - this.state.lastX;
    const shiftY = e.pageY - this.state.lastY;
    const currentLeft = parseInt(clone.style.left, 10) || 0;
    const currentTop = parseInt(clone.style.top, 10) || 0;
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
    if (!this.state) return;
    e.preventDefault();
    const clone = this.state.clone;
    clone.style.transform = clone.style.transform ? "" : `rotate(0.25turn)`;
    clone.style.setProperty("--rotation", toggle_orientation(clone.style.getPropertyValue("--rotation")));
  };

  private onContextMenu = (e: MouseEvent) => {
    if (!this.state) return;
    e.preventDefault();
    const clone = this.state.clone;
    clone.style.transform = clone.style.transform ? "" : `rotate(0.25turn)`;
    clone.style.setProperty("--rotation", toggle_orientation(clone.style.getPropertyValue("--rotation")));
  };
}

