import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const THEME_COLOR = '#0b1020';

export default defineConfig(({ mode }) => {
  // VITE_BASE=/roci-crawler/ für Hosting in einem Unterpfad (z. B. GitHub Pages).
  const base = loadEnv(mode, '.', 'VITE_').VITE_BASE ?? '/';

  return {
    base,
    // host: true -> Dev- und Preview-Server sind im lokalen WLAN erreichbar.
    server: { host: true, port: 5173 },
    preview: { host: true, port: 4173 },
    build: {
      target: 'es2022',
      // Phaser allein ist ~1,2 MB; das ist für ein Spiel erwartbar.
      chunkSizeWarningLimit: 1500,
      rolldownOptions: {
        output: {
          // Phaser ändert sich selten: eigener Chunk, damit Spiel-Updates (und der Service-Worker-Cache) klein bleiben.
          codeSplitting: { groups: [{ name: 'phaser', test: /node_modules[\\/]phaser[\\/]/ }] },
        },
      },
    },
    plugins: [
      VitePWA({
        // 'prompt': ein neues Release wird erst nach Tippen auf den Toast aktiv,
        // damit eine laufende Mission nicht mitten im Spiel neu lädt.
        registerType: 'prompt',
        injectRegister: false,
        includeAssets: ['favicon.ico', 'favicon.svg', 'apple-touch-icon-180x180.png'],
        manifest: {
          name: 'Roci Crawler',
          short_name: 'Roci Crawler',
          description: 'Action-RPG im Universum von The Expanse (privates Fanprojekt).',
          lang: 'de',
          theme_color: THEME_COLOR,
          background_color: THEME_COLOR,
          display: 'fullscreen',
          display_override: ['fullscreen', 'standalone'],
          orientation: 'any',
          categories: ['games'],
          icons: [
            { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
            { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
            { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
            { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
          cleanupOutdatedCaches: true,
          navigateFallback: 'index.html',
        },
        // Der Service Worker läuft nur im Produktions-Build (npm run build && npm run preview).
        devOptions: { enabled: false },
      }),
    ],
  };
});
