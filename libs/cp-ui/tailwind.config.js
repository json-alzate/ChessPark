/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{html,ts,tsx, scss}',
  ],
  safelist: [
    'btn',
    'btn-primary',
    'alert',
    'alert-error',
    'badge',
    'badge-info',
  ],
  theme: {
    extend: {},
  },
  plugins: [require('daisyui')],
  daisyui: {
    themes: ['light', 'dark'], //  temas
  },
};
