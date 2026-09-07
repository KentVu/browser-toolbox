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
    setupFiles: ['./mock-extension-apis.ts'],
    // Maybe this is not needed, since 'github-action' reporter is enabled by default on github actions. https://vitest.dev/guide/reporters.html#github-actions-reporter
    reporters: ['default', 'junit', 'json'],
    outputFile: {
      junit: './test-results/junit.xml',
      json: './test-results/results.json',
    },
  },
})