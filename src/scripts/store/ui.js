import { defineStore } from 'pinia'

let seq = 0

/**
 * 全局反馈层：toast 队列 + 确认对话框。
 *
 * 替代原先散落的 35 处 alert() 和 17 处 confirm() —— 原生弹窗会阻塞主线程、
 * 无法样式化，黑色系统对话框压在暗色界面上也很突兀。
 */
export const useUiStore = defineStore('ui', {
  state: () => ({
    toasts: [],
    /** 当前挂起的确认请求；null 表示没有对话框 */
    dialog: null,
    _resolve: null
  }),

  actions: {
    /** 默认 4s 自动消失；error 留 7s，因为通常需要读完整句 */
    push(message, type = 'info', duration) {
      const id = ++seq
      const ms = duration ?? (type === 'error' ? 7000 : 4000)
      // 同类提示堆太多时丢掉最旧的，避免连环失败刷满屏
      if (this.toasts.length >= 4) this.toasts.splice(0, this.toasts.length - 3)
      this.toasts.push({ id, message, type })
      if (ms > 0) setTimeout(() => this.dismiss(id), ms)
      return id
    },

    error(message, duration) { return this.push(message, 'error', duration) },
    success(message, duration) { return this.push(message, 'success', duration) },
    info(message, duration) { return this.push(message, 'info', duration) },
    warn(message, duration) { return this.push(message, 'warn', duration) },

    dismiss(id) {
      const i = this.toasts.findIndex((t) => t.id === id)
      if (i > -1) this.toasts.splice(i, 1)
    },

    /**
     * 询问用户。resolve 为所选 action 的 value，取消/关闭/Esc 一律 resolve 'cancel'。
     *
     * actions 省略时就是一个"确定/取消"二选一，配合 confirm() 用。
     */
    ask(options) {
      const {
        title = '请确认',
        message = '',
        actions = [{ value: 'ok', label: '确定', primary: true }],
        cancelLabel = '取消'
      } = options

      // 已有对话框时先按取消关掉，避免调用方漏 await 导致对话框互相覆盖
      if (this.dialog) this.settle('cancel')

      this.dialog = { title, message, actions, cancelLabel }
      return new Promise((resolve) => { this._resolve = resolve })
    },

    /** 布尔版：true = 用户点了确认 */
    async confirm(options) {
      const choice = await this.ask({
        ...options,
        actions: [{
          value: 'ok',
          label: options?.confirmLabel || '确定',
          primary: !options?.danger,
          danger: options?.danger
        }]
      })
      return choice === 'ok'
    },

    settle(value) {
      this.dialog = null
      this._resolve?.(value)
      this._resolve = null
    }
  }
})

/**
 * 把 Error / 响应体统一成一句人话。
 * 原先每个 catch 都在手写 (err.message || err) 这类拼接，措辞十几种。
 */
export function errText(error, fallback = '操作失败') {
  if (!error) return fallback
  if (typeof error === 'string') return error
  if (error.response?.data?.message) return error.response.data.message
  if (error.message) return error.message
  return fallback
}
