export function mouseDownHandler(this: HTMLElement, event: MouseEvent) {
    let originalElement = this;
    
    let clone = this.cloneNode(true) as HTMLElement;
    clone.style.pointerEvents = 'none';
    clone.style.zIndex = '1000';
    
    originalElement.parentElement!.appendChild(clone);

    this.classList.add('dragging');
    console.log('Started ship dragging!', this);

    let lastX = event.pageX;
    let lastY = event.pageY;

    function onMouseMove(e: MouseEvent) {
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


    function onMouseUp(e: MouseEvent) {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        clone.remove();
        originalElement.classList.remove('dragging');
        console.log('Stopped ship dragging!', originalElement);
    }

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
}

// mouseMoveHandler is now inlined in mouseDownHandler