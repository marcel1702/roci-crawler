import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

// `npm run icons` erzeugt alle PWA-Icons aus public/favicon.svg.
export default defineConfig({
  preset: {
    ...minimal2023Preset,
    // Das Quellbild füllt die ganze Fläche; ein Rand würde als hellerer Streifen sichtbar.
    transparent: { ...minimal2023Preset.transparent, padding: 0 },
    maskable: {
      ...minimal2023Preset.maskable,
      resizeOptions: { background: '#0b1020', fit: 'contain' },
    },
    apple: {
      ...minimal2023Preset.apple,
      resizeOptions: { background: '#0b1020', fit: 'contain' },
    },
  },
  images: ['public/favicon.svg'],
});
