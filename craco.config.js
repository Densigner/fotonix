// CRACO config to add PostCSS plugins for Tailwind CSS + Autoprefixer
module.exports = {
  // Keep default Babel config; react-refresh is handled by CRA tooling.
  babel: {},
  style: {
    postcss: {
      plugins: [
  require('@tailwindcss/postcss'),
  require('autoprefixer'),
      ],
    },
  },
};
