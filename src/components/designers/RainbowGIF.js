/**
 * Generate a rainbow preview GIF for a Fabric.js canvas.
 * - Adds two temporary layers:
 *   1) edge: neon rainbow stroke hugging the mirror edge
 *   2) glow: full-canvas rainbow gradient clipped to clones of user objects
 * - Captures frames and returns a GIF data URL.
 *
 * @param {fabric.Canvas} canvas  A live Fabric.js Canvas instance
 * @param {Object} [opts]
 * @param {number} [opts.steps=24]  Number of frames (more = smoother, larger file)
 * @param {number} [opts.fps=12]    Frames per second for the GIF
 * @param {number} [opts.opacity=0.85]  Glow opacity (0–1)
 * @returns {Promise<string>} data URL (e.g. "data:image/gif;base64,...")
 */
export async function generateRainbowGif(canvas, opts = {}) {
  const { steps = 24, fps = 12, opacity = 0.85 } = opts;
  const F = window.fabric;
  if (!canvas || !F) throw new Error("Fabric canvas not available");

  // Load gifshot if not already present
  const gifshot = await (async () => {
    if (window.gifshot) return window.gifshot;
    await new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/gifshot@0.4.5/build/gifshot.min.js";
      s.async = true;
      s.onload = () => resolve();
      s.onerror = (e) => reject(e);
      document.head.appendChild(s);
    });
    return window.gifshot;
  })();

  // Build rainbow color stops for a given hue
  function makeRainbowStops(h) {
    const stops = [];
    const segments = 6;
    for (let i = 0; i <= segments; i++) {
      const hue = (h + (i * 360) / segments) % 360;
      stops.push({ offset: i / segments, color: `hsl(${hue} 85% 60%)` });
    }
    return stops;
  }

  // Create temp layers: glow (clipped to user content) + edge (around the mirror)
  async function buildThroughGlowLayers() {
    // anything that is NOT a mirror/safe overlay is "user content"
  const userObjs = canvas.getObjects().filter((o) => !o._mirrorLayer && !o._safeArea);

    // Clone objects for a stable clipPath (won’t mutate originals)
    const clones = await Promise.all(
      userObjs.map((o) =>
        new Promise((resolve) => {
          try {
            o.clone((cl) => {
              cl.set({ selectable: false, evented: false });
              resolve(cl);
            });
          } catch {
            resolve(null);
          }
        })
      )
    );
    const validClones = clones.filter(Boolean);

    // Glow rect that we’ll clip to user content
    const glow = new F.Rect({
      left: 0,
      top: 0,
      width: canvas.getWidth(),
      height: canvas.getHeight(),
      opacity,
      selectable: false,
      evented: false,
    });
    if (validClones.length) {
      const gp = new F.Group(validClones, { absolutePositioned: true });
      gp.excludeFromExport = true;
      glow.clipPath = gp;
    }
    glow._gifGlow = true;

    // Edge stroke hugging the inner frame area (adjust margins to your frame)
    const edge = new F.Rect({
      left: 6,
      top: 6,
      width: canvas.getWidth() - 12,
      height: canvas.getHeight() - 12,
      rx: 14,
      ry: 14,
      fill: "",
      strokeWidth: 18,
      selectable: false,
      evented: false,
    });
    edge._gifEdge = true;

    canvas.add(glow);
    canvas.add(edge);

    // Keep your safe-area overlay on top if you have one
  const safe = canvas.getObjects().find((o) => o._safeArea === true);
    if (safe) safe.bringToFront();

    return { glow, edge };
  }

  function cleanupThroughGlowLayers() {
    const temp = canvas.getObjects().filter((o) => o._gifGlow || o._gifEdge);
    temp.forEach((o) => canvas.remove(o));
    canvas.requestRenderAll();
  }

  // ---- Generate frames
  const { glow, edge } = await buildThroughGlowLayers();
  const frames = [];
  const gifWidth = canvas.getWidth();
  const gifHeight = canvas.getHeight();

  for (let i = 0; i < steps; i++) {
    const hue = (i * (360 / steps)) % 360;

    glow.set(
      "fill",
      new F.Gradient({
        type: "linear",
        gradientUnits: "percentage",
        coords: { x1: 0, y1: 0, x2: 1, y2: 1 },
        colorStops: makeRainbowStops(hue),
      })
    );

    edge.set(
      "stroke",
      new F.Gradient({
        type: "linear",
        gradientUnits: "percentage",
        coords: { x1: 0, y1: 0, x2: 1, y2: 0 },
        colorStops: makeRainbowStops((hue + 60) % 360),
      })
    );

    canvas.requestRenderAll();
    frames.push(canvas.toDataURL({ format: "png" }));
  }

  cleanupThroughGlowLayers();

  // ---- Assemble GIF
  const interval = 1 / fps; // seconds per frame
  const dataUrl = await new Promise((resolve, reject) => {
    gifshot.createGIF(
      {
        images: frames,
        gifWidth,
        gifHeight,
        interval,
        numFrames: frames.length,
        sampleInterval: 3,
        numWorkers: 2,
      },
      (obj) => {
        if (obj.error) return reject(obj.errorMsg || "GIF generation failed");
        resolve(obj.image); // data:image/gif;base64,....
      }
    );
  });

  return dataUrl;
}
