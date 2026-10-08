import preact from '@preact/preset-vite'
import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths(), preact({ reactAliasesEnabled: false })],
  test: {
    //environment: 'web-ext',
    environment: 'happy-dom',
    environmentOptions: {
      'web-ext': {
        path: './dist_chrome',
      },
    },
    setupFiles: ['./mock-extension-apis.ts'],
  },
})