// Not actually used by the CRA/CRACO production build (that pipeline is
// configured directly in craco.config.js) — kept only so editor tooling
// (e.g. the Tailwind CSS IntelliSense extension) can still resolve a plain
// PostCSS config for this project.
const path = require('path');

module.exports = {
  plugins: {
    '@tailwindcss/postcss': { base: path.resolve(__dirname) },
    autoprefixer: {},
  },
};
