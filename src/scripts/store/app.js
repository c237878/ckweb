import { defineStore } from 'pinia'
import { settingApi } from '@/scripts/api'

const THEME_KEY = 'ck_theme'

const readTheme = () => {
  try {
    return localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

const applyTheme = (theme) => {
  if (theme === 'light') document.documentElement.setAttribute('data-theme', 'light')
  else document.documentElement.removeAttribute('data-theme')
}

/**
 * 全局设置与主题。
 * 之前 siteName 由 App.vue / AppHeader / AppFooter 各自请求一次，pageSize 由每个列表页各请求一次；
 * 跨组件同步靠 window 自定义事件。这里收敛成一份状态，设置保存后调 refresh()。
 */
export const useAppStore = defineStore('app', {
  state: () => ({
    siteName: '影视网站',
    pageSize: 12,
    /** 系列 / 演员单独配的每页数量；0 表示没配过，走 getter 回落到 pageSize */
    pageSizeSetting: 0,
    homeCategoryCount: 12,
    theme: readTheme(),
    loaded: false,
    _pending: null
  }),

  getters: {
    /** 主题切换按钮的提示文案 */
    themeLabel: (state) => (state.theme === 'dark' ? '切换到亮色' : '切换到暗色'),
    /**
     * 系列与演员列表的每页数量。卡片比影片小得多，一屏想看到的数量不是一回事，
     * 但大多数人不会去动这个设置，所以没单独配过时回落到影片的每页数量。
     */
    personPageSize: (state) => (state.pageSizeSetting > 0 ? state.pageSizeSetting : state.pageSize)
  },

  actions: {
    /** 首次加载；并发调用只会真正请求一次 */
    async init() {
      applyTheme(this.theme)
      if (this.loaded) return
      if (this._pending) return this._pending
      this._pending = this.refresh().finally(() => { this._pending = null })
      return this._pending
    },

    async refresh() {
      try {
        const res = await settingApi.getAll()
        const rows = res?.success && Array.isArray(res.data) ? res.data : []
        const map = {}
        rows.forEach((row) => { map[row.name] = row.content })

        if (map.siteName) {
          this.siteName = map.siteName
          document.title = map.siteName
        }
        const size = parseInt(map.pageSize, 10)
        this.pageSize = size > 0 ? size : 12
        const personSize = parseInt(map.personPageSize, 10)
        this.pageSizeSetting = personSize > 0 ? personSize : 0
        const homeSize = parseInt(map.homePageCategoryCount, 10)
        this.homeCategoryCount = homeSize > 0 ? homeSize : 12
        this.loaded = true
      } catch (error) {
        console.error('加载站点设置失败:', error)
      }
    },

    toggleTheme() {
      this.theme = this.theme === 'dark' ? 'light' : 'dark'
      applyTheme(this.theme)
      try {
        localStorage.setItem(THEME_KEY, this.theme)
      } catch {
        /* 隐私模式下 localStorage 不可用，切换仍然生效，只是不记忆 */
      }
    }
  }
})
