// Slope and Signal - Vite config. Written with Claude (Anthropic).
import { defineConfig } from 'vite';
export default defineConfig({
  base: process.env.BASE_PATH ?? '/slope-and-signal/',
  test: { include: ['tests/**/*.test.ts'] },
} as any);
