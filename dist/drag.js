import { toggle_orientation } from "./structs.js";
export function mouseDownHandler(event) {
    let originalElement = this;
    let clone = this.cloneNode(true);
    clone.classList.add('dragged_clone');
    clone.style.pointerEvents = 'none';
    clone.style.zIndex = '1000';
    originalElement.parentElement.appendChild(clone);
    this.classList.add('dragged');
    console.log('Started ship dragging!', this);
    let lastX = event.pageX;
    let lastY = event.pageY;
    function onMouseMove(e) {
        const shiftX = e.pageX - lastX;
        const shiftY = e.pageY - lastY;
        // Parse current left/top as numbers
        const currentLeft = parseInt(clone.style.left, 10) || 0;
        const currentTop = parseInt(clone.style.top, 10) || 0;
        clone.style.left = (currentLeft + shiftX) + 'px';
        clone.style.top = (currentTop + shiftY) + 'px';
        lastX = e.pageX;
        lastY = e.pageY;
        console.log('Ship moved!', clone.style.left, clone.style.top);
    }
    function onMouseUp(e) {
        if (e.button === 2) { // right click
            return;
        }
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        clone.remove();
        originalElement.classList.remove('dragged');
        console.log('Stopped ship dragging!', originalElement);
    }
    function onWheel(e) {
        e.preventDefault();
        console.log('Ship rotation!', originalElement);
        clone.style.transform ? clone.style.transform = "" : clone.style.transform = `rotate(0.25turn)`;
        clone.dataset.rotation = toggle_orientation(clone.dataset.rotation);
    }
    function onContextMenu(e) {
        e.preventDefault();
        console.log('Ship rotation (context menu)!', originalElement);
        clone.style.transform ? clone.style.transform = "" : clone.style.transform = `rotate(0.25turn)`;
        clone.dataset.rotation = toggle_orientation(clone.dataset.rotation);
    }
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.addEventListener('wheel', onWheel, { passive: false });
    document.addEventListener('contextmenu', onContextMenu);
}
// mouseMoveHandler is now inlined in mouseDownHandler
