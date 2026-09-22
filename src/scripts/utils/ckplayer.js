/**
 * ckplayer 按需加载。
 *
 * 它原先挂在 index.html 的 <head> 里，每个页面都同步下载解析，而全站只有影片详情页用到它。
 * public/ckplayer 下有 13MB（hls.js 10M、flv.js 1.7M、mpegts.js 992K），但只有
 * ckplayer.js + ckplayer.css 被引用过。
 */

const SCRIPT_SRC = '/ckplayer/js/ckplayer.js'
const STYLE_SRC = '/ckplayer/css/ckplayer.css'

let pending = null

// 详情页的播放器容器 div 就叫 #ckplayer，浏览器会把同名元素挂到 window 上，
// 所以只能用"是不是函数"来判断库是否真的加载好了。
const isReady = () => typeof window.ckplayer === 'function'

export function loadCkplayer() {
  if (typeof window === 'undefined') return Promise.reject(new Error('仅在浏览器环境可用'))
  if (isReady()) return Promise.resolve(window.ckplayer)
  if (pending) return pending

  pending = new Promise((resolve, reject) => {
    if (!document.querySelector(`link[href="${STYLE_SRC}"]`)) {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = STYLE_SRC
      document.head.appendChild(link)
    }

    const script = document.createElement('script')
    script.src = SCRIPT_SRC
    script.onload = () => {
      if (isReady()) resolve(window.ckplayer)
      else reject(new Error('ckplayer 已加载但未挂载 window.ckplayer'))
    }
    script.onerror = () => {
      pending = null
      reject(new Error('ckplayer 加载失败'))
    }
    document.head.appendChild(script)
  })

  return pending
}
