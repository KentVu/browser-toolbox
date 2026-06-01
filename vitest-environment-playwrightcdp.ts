import type { Environment } from 'vitest/runtime'
import { builtinEnvironments, populateGlobal } from 'vitest/runtime'

export default <Environment>{
  name: 'playwrightcdp',
  viteEnvironment: 'ssr',
  // optional - only if you support "vmForks" or "vmThreads" pools
  async setupVM() {
    const vm = await import('node:vm')
    const context = vm.createContext()
    return {
      getVmContext() {
        return context
      },
      teardown() {
        // called after all tests with this env have been run
      }
    }
  },
  setup() {
    // custom setup
    return {
      teardown() {
        // called after all tests with this env have been run
      }
    }
  }
}
