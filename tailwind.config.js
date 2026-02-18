/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brasper: {
          primary: '#007bff',
          ios: '#007aff',
          blue: '#3b82f6',
          blueAlt: '#4484f3',
          blueStrong: '#066ac9',
          success: '#10b981',
          successSoft: '#5ED6B3',
          lime: '#e6ff00',
          limeStrong: '#cbf000',
          purple: '#A386FF',
          purpleDark: '#4A52D8',
          danger: '#dc3545',
          dark: '#232b4d',
          darkSoft: '#1c284c',
          darkDeep: '#0F123E',
          text: '#333333',
          textSoft: '#666666',
          bg: '#f3f4f6',
          bgSoft: '#f9f9f9'
        },
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
