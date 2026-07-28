module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
// Temporarily disable Tailwind as a PostCSS plugin to avoid CRA PostCSS errors.
// We keep this file so a full integration (CRACO or react-scripts upgrade) can
// reuse it later. For now we rely on the Tailwind Play CDN in public/index.html.
module.exports = {
  plugins: {
    // '@tailwindcss/postcss': {}, // keep for reference; enable when CRA pipeline is overridden
    autoprefixer: {},
  },
};
