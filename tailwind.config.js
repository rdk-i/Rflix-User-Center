/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./public/**/*.html",
    "./public/**/*.js",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        gray: {
          850: '#18181b', // Zinc 900
          900: '#09090b', // Zinc 950
          950: '#000000', // Black
        },
        primary: {
          400: '#a1a1aa', // Zinc 400
          500: '#71717a', // Zinc 500
          600: '#52525b', // Zinc 600
          700: '#3f3f46', // Zinc 700
          800: '#27272a', // Zinc 800
        },
        dark: {
          card: 'rgba(9, 9, 11, 0.6)',
          border: 'rgba(255, 255, 255, 0.1)',
        }
      },
      backgroundImage: {
        'rflix-gradient': 'linear-gradient(to bottom right, #09090b, #18181b)',
        'glass-gradient': 'linear-gradient(180deg, rgba(24, 24, 27, 0.4) 0%, rgba(9, 9, 11, 0.6) 100%)',
      },
      backdropBlur: {
        xs: '2px',
      }
    },
  },
  plugins: [],
}
