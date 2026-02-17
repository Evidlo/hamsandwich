/// <reference types="vitest/config" />
import { defineConfig } from 'vite'

export default defineConfig({
  base: '/ham/',
  server: {
    host: '0.0.0.0',
    port: 8009,
    allowedHosts: ['copernicus.ece.illinois.edu'],
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
})
