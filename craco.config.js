// CRACO config to add Autoprefixer as a PostCSS plugin.
//
// Tailwind itself is NOT run here — see src/tailwind-source.css and
// scripts/build-tailwind.js. CRACO/webpack's postcss-loader pipeline didn't
// reliably run Tailwind v4's filesystem content-scan (it worked fine
// standalone via plain postcss, but produced zero utility classes when
// invoked through this webpack pipeline, regardless of plugin ordering or
// an explicit `base` option), so Tailwind is pre-compiled as a separate
// build step instead and imported here as plain, already-compiled CSS.
module.exports = {
  // Keep default Babel config; react-refresh is handled by CRA tooling.
  babel: {},
  style: {
    postcss: {
      plugins: (craDefaultPlugins) => [
        ...craDefaultPlugins,
        require('autoprefixer'),
      ],
    },
  },
};
