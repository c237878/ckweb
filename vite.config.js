import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueJsx(), // 支持 JSX/TSX
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
  server: {
    port: 3001,
    host: '0.0.0.0',
    // 确保所有路由都返回 index.html (SPA 支持)
    proxy: {
      // 代理 /api 请求到 ckapi 后端
      '/api': {
        target: 'http://localhost:5033',
        changeOrigin: true,
        // 大文件上传关键配置
        configure: (proxy) => {
          // 禁用服务端超时，让连接保持活跃
          proxy.on('proxyRes', (proxyRes) => {
            proxyRes.socket.setTimeout(0)
          })
          // 禁用请求端超时
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.setTimeout(0)
          })
        }
      },
    },
    // 开发服务器配置 - 确保所有路由都返回 index.html
    fs: {
      strict: false
    }
  },
  // 构建优化
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['vue', 'vue-router', 'pinia'],
        }
      }
    },
    chunkSizeWarningLimit: 1000,
  },
  // 依赖优化
  optimizeDeps: {
    include: ['vue', 'vue-router', 'pinia']
  }
})
