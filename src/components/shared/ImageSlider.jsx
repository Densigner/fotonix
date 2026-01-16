import React, { useState, useEffect, useRef } from "react";

/**
 * <ImageSlider images={[{src, alt}, ...]} />
 *
 * - Click arrows or thumbnails to navigate
 * - Use ← / → keys to move
 * - Designed for transparent PNG previews (object-fit: contain)
 */
export default function ImageSlider({ images = [], initialIndex = 0, showThumbnails = true }) {
  const [index, setIndex] = useState(Math.max(0, Math.min(initialIndex, images.length - 1)));
  const containerRef = useRef(null);

  useEffect(() => {
    function onKey(e) {
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, images.length]);

  useEffect(() => {
    // clamp index if images change
    if (index >= images.length) setIndex(Math.max(0, images.length - 1));
  }, [images.length]);

  function prev() {
    setIndex(i => (i - 1 + images.length) % images.length);
  }
  function next() {
    setIndex(i => (i + 1) % images.length);
  }
  function choose(i) {
    setIndex(i);
    // put focus on container for keyboard continuity
    containerRef.current?.focus();
  }

  if (!images || images.length === 0) {
    return <div style={styles.empty}>No images provided</div>;
  }

  const curr = images[index];

  return (
    <div style={styles.wrapper}>
      <div style={styles.frame} ref={containerRef} tabIndex={0} aria-roledescription="image carousel">
        {/* dashed background preview area */}
        <div style={styles.previewArea}>
          <img
            src={curr.src}
            alt={curr.alt || `Image ${index + 1}`}
            style={styles.image}
            draggable={false}
          />
        </div>

        {/* controls */}
        <button aria-label="Previous" onClick={prev} style={{ ...styles.arrow, ...styles.left }}>
          <ArrowLeft />
        </button>
        <button aria-label="Next" onClick={next} style={{ ...styles.arrow, ...styles.right }}>
          <ArrowRight />
        </button>

        {/* small caption */}
        <div style={styles.caption}>Tip: export with transparent background for best glow</div>
      </div>

      {showThumbnails && (
        <div style={styles.thumbs}>
          {images.map((it, i) => (
            <button
              key={i}
              onClick={() => choose(i)}
              aria-pressed={i === index}
              style={{
                ...styles.thumbBtn,
                boxShadow: i === index ? "0 0 0 3px rgba(255,102,178,0.18)" : undefined,
                borderColor: i === index ? "transparent" : "#2f3740"
              }}
            >
              <img src={it.src} alt={it.alt || `Thumb ${i + 1}`} style={styles.thumbImg} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* --- tiny inline styles (replace with your classes if you prefer) --- */
const styles = {
  wrapper: {
    width: "100%",
    maxWidth: 920,
    margin: "0 auto",
    display: "flex",
    flexDirection: "column",
    gap: 12,
    alignItems: "center"
  },
  frame: {
    position: "relative",
    width: "100%",
    height: 520,
    borderRadius: 14,
    background: "linear-gradient(180deg,#0b1220,#0a1017)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.02)",
    overflow: "hidden",
    outline: "none"
  },
  previewArea: {
    position: "absolute",
    inset: 24,
    borderRadius: 10,
    border: "2px dashed rgba(148,163,184,0.12)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "transparent",
    padding: 12
  },
  image: {
    maxHeight: "100%",
    maxWidth: "100%",
    objectFit: "contain",
    pointerEvents: "none",
    filter: "drop-shadow(0 18px 35px rgba(0,0,0,0.6))"
  },
  arrow: {
    position: "absolute",
    top: "50%",
    transform: "translateY(-50%)",
    width: 44,
    height: 44,
    borderRadius: 999,
    border: "1px solid rgba(47,55,64,0.6)",
    background: "#0f1720",
    color: "#ff66b2",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    boxShadow: "0 6px 18px rgba(2,6,23,0.6)"
  },
  left: { left: 20 },
  right: { right: 20 },
  caption: {
    position: "absolute",
    left: 28,
    bottom: 14,
    fontSize: 12,
    color: "#98a3b3"
  },
  thumbs: {
    display: "flex",
    gap: 10,
    justifyContent: "center",
    alignItems: "center",
    padding: "6px 0"
  },
  thumbBtn: {
    width: 84,
    height: 48,
    borderRadius: 8,
    overflow: "hidden",
    border: "1px solid #2f3740",
    padding: 0,
    background: "transparent",
    cursor: "pointer"
  },
  thumbImg: {
    width: "100%",
    height: "100%",
    objectFit: "contain",
    background: "rgba(0,0,0,0.08)"
  },
  empty: {
    padding: 20,
    color: "#999",
    background: "#0a1016",
    borderRadius: 8,
    textAlign: "center"
  }
};

/* tiny arrow svgs */
function ArrowLeft() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M15 19l-7-7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function ArrowRight() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
