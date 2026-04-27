// Single-family typography — every text in the app renders in Fredoka.
// Fredoka has 5 weights (300/400/500/600/700) but we floor at 500 so the
// chunky brand voice is consistent everywhere. 700 is the heaviest available
// (no ExtraBold/Black variants); `strong` caps at 700.
//
// Weights are loaded by useFonts() in App.tsx and the runtime mapping for
// Tailwind/NativeWind weight classes lives in src/lib/fontPatch.ts.

export const petTypography = {
  display: 'Fredoka_700Bold',     // titles, "Nomi" name, big numbers
  heading: 'Fredoka_600SemiBold', // section headers, button labels, badges
  body: 'Fredoka_500Medium',      // dialogue, descriptions, body copy
  strong: 'Fredoka_700Bold',      // emphasized labels, uppercase eyebrows
} as const;
