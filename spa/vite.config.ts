import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

export default defineConfig({
  plugins: [react(), viteSingleFile()],
  build: {
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
  },
})
