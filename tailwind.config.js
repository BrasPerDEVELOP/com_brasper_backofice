/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brasper: {
          /** Logo BrasPer: cian → índigo */
          cyan: '#29B6F6',
          cyanLight: '#40C4FF',
          indigo: '#5C6BC0',
          indigoStrong: '#3F51B5',
          indigoDark: '#283593',
          primary: '#3F51B5',
          ios: '#29B6F6',
          blue: '#5C6BC0',
          blueAlt: '#5C6BC0',
          blueStrong: '#283593',
          success: '#29B6F6',
          successSoft: '#40C4FF',
          accent: '#40C4FF',
          lime: '#40C4FF',
          limeStrong: '#29B6F6',
          purple: '#5C6BC0',
          purpleDark: '#3F51B5',
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
        primary: 'rgb(63 81 181)',
        error: 'rgb(220 38 38)'
      }
    }
  },
  plugins: []
}
