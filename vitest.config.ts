import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    //environment: 'web-ext',
    environment: 'happy-dom',
    environmentOptions: {
      'web-ext': {
        path: './dist_chrome',
      },
    },
    setupFiles: ['./vitest.setup.ts'],
  }
})