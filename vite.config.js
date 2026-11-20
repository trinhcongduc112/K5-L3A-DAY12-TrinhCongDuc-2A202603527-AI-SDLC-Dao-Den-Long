import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { leaderboardMiddleware } from './scripts/leaderboard-store.js';

const entry = relative => fileURLToPath(new URL(relative, import.meta.url));
const leaderboard = {
  name: 'dao-local-leaderboard',
  configureServer(server) { server.middlewares.use(leaderboardMiddleware); },
  configurePreviewServer(server) { server.middlewares.use(leaderboardMiddleware); },
};
export default defineConfig({
  base: './',
  plugins: [leaderboard],
  build: { rollupOptions: { input: { game: entry('./index.html'), benchmark: entry('./benchmark.html') } } },
});
