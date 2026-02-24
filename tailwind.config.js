/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './App.{js,ts,tsx}',
    './src/**/*.{js,ts,tsx}',
    './src/components/**/*.{js,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        'pet-blue': {
          DEFAULT: '#4FB0C6',
          light: '#A5DEE4',
          dark: '#3792A6',
        },
        'pet-green': {
          DEFAULT: '#88C057',
          light: '#C4E6A3',
          dark: '#6A9E41',
        },
        'pet-pink': {
          DEFAULT: '#FF8FAB',
          light: '#FFC8DD',
          dark: '#E07A94',
        },
        'pet-yellow': {
          DEFAULT: '#FFD93D',
          light: '#FFF5B8',
          dark: '#E6C12E',
        },
        'pet-purple': {
          DEFAULT: '#9381FF',
          light: '#B8AFF9',
          dark: '#766BD1',
        },
        'pet-background': '#F8F9FE',
      },
      borderRadius: {
        '4xl': '32px',
        '5xl': '40px',
      },
    },
  },
  plugins: [],
};

