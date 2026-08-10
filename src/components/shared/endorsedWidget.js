import React, { useEffect } from "react";

// Shared by both the Shop Builder and the Funnel Builder so there's one
// copy of the Endorsed.Review integration, not two. Endorsed.Review is
// Fotonix's own review platform (see C:\Users\joshm\Desktop\endorsed.review)
// -- the widget shows real, live reviews of the Fotonix products being
// sold, pulled client-side from api.endorsed.review, the same way any
// third-party site would embed it (this isn't a special integration, it's
// literally their public widget.js loader).

export const ENDORSED_WIDGET_TYPES = [
  { value: "basic-stars", label: "Star rating" },
  { value: "review-list", label: "Review list" },
  { value: "carousel", label: "Carousel" },
  { value: "badge", label: "Badge" },
  { value: "grid", label: "Grid" },
];

// Fotonix's own Endorsed.Review business account id (not the "fotonix"
// slug -- the widget needs the internal userId). DNS/nginx are up as of
// 2026-08-10, but the currently-deployed server.js on the VPS still 404s
// on GET /api/business/:slug and /api/widget-embed/:userId (Express's own
// "Cannot GET", meaning nginx *is* proxying to the Node app correctly --
// the routes just aren't in whatever code is actually running yet). Needs
// `bash deploy/deploy.sh` from the endorsed.review project to push the
// current server.js. Left populated anyway: every Reviews block just shows
// the widget script's own graceful "Unable to load reviews" state until
// that deploy lands, then starts working with zero further changes here.
export const ENDORSED_FOTONIX_USER_ID = "RNLTUfrluHNAvmReypbok74OO8g1";

// Loads endorsed.review's real widget.js loader once, then asks it to
// (re)scan the page for any [data-user]/.endorsed-widget containers --
// safe to call from every mounted Reviews block, not just the first one:
// if the script is already loaded, this just re-triggers a scan (picks up
// a block added after the initial page load); if not, it loads the script
// once and lets its own DOMContentLoaded/load-triggered scan find every
// container already in the DOM by the time it finishes loading.
export function useEndorsedWidgetScript() {
  useEffect(() => {
    if (window.EndorsedReview) {
      window.EndorsedReview.init();
      return;
    }
    let script = document.querySelector('script[data-endorsed-widget]');
    if (!script) {
      script = document.createElement("script");
      script.src = "https://endorsed.review/widget.js";
      script.async = true;
      script.setAttribute("data-endorsed-widget", "1");
      document.body.appendChild(script);
    }
    script.addEventListener("load", () => window.EndorsedReview?.init?.());
  }, []);
}

// `color` accepts any valid CSS color, including a CSS custom property
// reference like "var(--accent)" -- the widget script just interpolates it
// straight into an inline style, so passing the Shop Builder's own theme
// token here means the widget picks up the storefront's brand color
// automatically, no hex snapshot needed.
export function EndorsedWidget({ type = "basic-stars", theme = "light", color, branding = true, userId }) {
  useEndorsedWidgetScript();
  const uid = userId || ENDORSED_FOTONIX_USER_ID;

  if (!uid) {
    return (
      <div style={{ padding: 20, border: "1px dashed #d1d5db", borderRadius: 8, fontSize: 13, color: "#6b7280", textAlign: "center" }}>
        Reviews widget not connected yet — Endorsed.Review's business ID hasn't been set (its API is currently unreachable, see the deploy notes).
      </div>
    );
  }

  return (
    <div
      className="endorsed-widget"
      data-type={type}
      data-user={uid}
      data-theme={theme}
      data-color={color}
      data-branding={branding ? "true" : "false"}
    />
  );
}
