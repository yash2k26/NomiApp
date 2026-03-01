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
          DEFAULT: '#4DA9D8',
          light: '#D8ECFA',
          dark: '#2F7CA7',
        },
        'pet-green': {
          DEFAULT: '#6DB9DF',
          light: '#D5E9F6',
          dark: '#3C84AE',
        },
        'pet-pink': {
          DEFAULT: '#8FBFDE',
          light: '#E4F1FA',
          dark: '#5B8EAF',
        },
        'pet-yellow': {
          DEFAULT: '#9EC7E3',
          light: '#E7F3FB',
          dark: '#6E9EBE',
        },
        'pet-purple': {
          DEFAULT: '#79B5DE',
          light: '#DDEFFD',
          dark: '#4A89B5',
        },
        'pet-orange': {
          DEFAULT: '#84BEE2',
          light: '#E4F2FB',
          dark: '#4E90B8',
        },
        'pet-gold': {
          DEFAULT: '#A2CDE8',
          light: '#EAF4FC',
          dark: '#6B9FBE',
        },
        'pet-background': '#F1F8FF',
      },
      borderRadius: {
        '4xl': '32px',
        '5xl': '40px',
      },
    },
  },
  plugins: [],
};
