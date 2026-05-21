import { defineConfig } from 'vitest/config'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  test: {
    environment: 'node',
    globals: true
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@interface': resolve(__dirname, 'src/interface'),
      '@modules': resolve(__dirname, 'src/modules')
    }
  }
})
