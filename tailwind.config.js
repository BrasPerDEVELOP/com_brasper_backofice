/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: 'rgb(248 250 252)',
        'surface-alt': 'rgb(241 245 249)',
        'on-surface': 'rgb(30 41 59)',
        primary: 'rgb(37 99 235)',
        error: 'rgb(220 38 38)'
      }
    }
  },
  plugins: []
}
