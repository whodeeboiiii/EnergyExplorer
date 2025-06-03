import { defineConfig } from 'vite';

export default defineConfig({
  optimizeDeps: {
    include: ['d3', 'topojson-client']
  },
  resolve: {
    alias: {
      'topojson-client': 'topojson-client/dist/topojson-client.js'
    }
  }
}); 