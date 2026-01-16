// Small helper to centralize adding an image/object to a Fabric canvas
export default function addImageToCanvas(canvas, img, options = {}) {
  // options: { padding: 0.1 } - fraction of canvas to leave as padding on each side
  if (!canvas || !img) return;

  const padding = typeof options.padding === 'number' ? options.padding : 0.1;

  try {
    // If the image has intrinsic dimensions, compute a scale to fit within the canvas
    try {
      const cw = (typeof canvas.getWidth === 'function') ? canvas.getWidth() : (canvas.width || 300);
      const ch = (typeof canvas.getHeight === 'function') ? canvas.getHeight() : (canvas.height || 200);
      if (img && img.width && img.height && cw > 0 && ch > 0) {
        const maxW = Math.max(8, cw * (1 - padding * 2));
        const maxH = Math.max(8, ch * (1 - padding * 2));
        const scale = Math.min(maxW / img.width, maxH / img.height, 1);
        if (isFinite(scale) && scale > 0) {
          // Use Fabric helper if available to keep stroke/controls consistent
          if (typeof img.scaleToWidth === 'function' && (img.width * scale) <= maxW) {
            img.scaleToWidth(img.width * scale);
          } else if (typeof img.scaleToHeight === 'function' && (img.height * scale) <= maxH) {
            img.scaleToHeight(img.height * scale);
          } else {
            img.scale(scale);
          }
        }
      }
    } catch (e) {
      // ignore fit errors
      console.warn('addImageToCanvas: fit computation failed', e);
    }

    // Center the image if not already positioned
    try {
      if (typeof img.set === 'function') img.set({ originX: 'center', originY: 'center' });
      const cw = (typeof canvas.getWidth === 'function') ? canvas.getWidth() : (canvas.width || 300);
      const ch = (typeof canvas.getHeight === 'function') ? canvas.getHeight() : (canvas.height || 200);
      if (typeof img.left === 'undefined' || img.left === null) img.left = cw / 2;
      if (typeof img.top === 'undefined' || img.top === null) img.top = ch / 2;
    } catch (e) {
      // ignore
    }

    canvas.add(img);
  } catch (e) {
    // if canvas.add unexpectedly fails, still try to proceed gracefully
    console.error('addImageToCanvas: canvas.add failed', e);
  }

  // update coords so Fabric's control box matches the rendered size
  try {
    if (typeof img.setCoords === 'function') img.setCoords();
  } catch (e) {
    // ignore
  }

  // Try to bring the newly added image to front if supported
  try {
    if (typeof img.bringToFront === 'function') img.bringToFront();
  } catch (e) {
    // ignore
  }

  try {
    canvas.setActiveObject(img);
  } catch (e) {
    // ignore
  }

  // Prefer requestRenderAll where available
  try {
    if (typeof canvas.requestRenderAll === 'function') canvas.requestRenderAll();
    else if (typeof canvas.renderAll === 'function') canvas.renderAll();
  } catch (e) {
    // ignore
  }
}

// CommonJS export for tests that use require()
if (typeof module !== 'undefined' && module.exports) {
  module.exports = addImageToCanvas;
}
