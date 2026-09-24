import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'

// 浏览器全局：项目没装 globals 包，这里显式声明用到的那几个
const browserGlobals = {
  window: 'readonly',
  document: 'readonly',
  navigator: 'readonly',
  localStorage: 'readonly',
  console: 'readonly',
  fetch: 'readonly',
  FormData: 'readonly',
  Blob: 'readonly',
  URL: 'readonly',
  alert: 'readonly',
  confirm: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  setInterval: 'readonly',
  clearInterval: 'readonly',
  performance: 'readonly',
  requestAnimationFrame: 'readonly',
  CustomEvent: 'readonly',
  Event: 'readonly',
  ResizeObserver: 'readonly',
  IntersectionObserver: 'readonly',
  MutationObserver: 'readonly',
  getComputedStyle: 'readonly',
  matchMedia: 'readonly',
  scrollTo: 'readonly',
  getSelection: 'readonly',
  CSS: 'readonly',
  Node: 'readonly',
  Element: 'readonly',
  HTMLElement: 'readonly',
  HTMLInputElement: 'readonly',
  HTMLTextAreaElement: 'readonly',
  Image: 'readonly',
  Math: 'readonly',
  Date: 'readonly',
  Promise: 'readonly',
  JSON: 'readonly',
  AbortController: 'readonly'
}

export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'public/**', '*.config.js']
  },
  js.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  {
    files: ['**/*.{js,mjs,vue}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: browserGlobals
    },
    rules: {
      // 现有代码里未使用变量较多，先以 warn 呈现，不当作构建阻断
      'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none' }],
      'vue/multi-word-component-names': 'off',
      'vue/no-v-html': 'off',
      'vue/require-default-prop': 'off',
      'vue/attributes-order': 'off',
      'vue/first-attribute-linebreak': 'off',
      'vue/html-self-closing': 'off',
      'vue/html-indent': 'off',
      'vue/html-closing-bracket-newline': 'off',
      'vue/singleline-html-element-content-newline': 'off',
      'vue/max-attributes-per-line': 'off'
    }
  }
]
