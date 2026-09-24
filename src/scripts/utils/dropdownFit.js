/**
 * 下拉面板自适应可用空间：下方放不下就压高度，上方更宽松就朝上翻。
 *
 * 面板是 absolute 浮层，会被最近的滚动祖先裁掉——影片编辑对话框的 .dialog__body
 * 就是 overflow-y: auto，"所属系列"展开时面板下半截直接掉到可视区外面。
 * 可用空间取决于此刻展开的位置，纯 CSS 算不出来，只能量。
 */

/** 与 .dropdown-menu 的 top: calc(100% + 4px) 对齐 */
const GAP = 4
/** 面板上下内缩 8 + 边框 2，这部分不装行 */
const CHROME = 10
/** 再矮就没有可用的了 */
const MIN_ROWS = 3

/** 行高跟着 --ctl-h-sm，别在这儿抄一份数字 */
function rowHeight() {
  const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ctl-h-sm'))
  return Number.isFinite(v) ? v : 32
}

/** 沿祖先求可视范围：滚动容器会裁剪绝对定位的后代，视口是兜底边界 */
function clipOf(menu) {
  let top = 0
  let bottom = window.innerHeight
  let node = menu.parentElement

  while (node && node !== document.documentElement) {
    const oy = getComputedStyle(node).overflowY
    if (oy === 'auto' || oy === 'scroll' || oy === 'hidden' || oy === 'clip') {
      const rect = node.getBoundingClientRect()
      top = Math.max(top, rect.top)
      bottom = Math.min(bottom, rect.bottom)
    }
    node = node.parentElement
  }

  return { top, bottom }
}

/**
 * @param menu   浮层元素（.dropdown-menu）
 * @param anchor 触发控件所在的定位容器（.dropdown / .actor-search）
 * @returns 停止跟随并还原样式的函数
 */
export function autoFitDropdown(menu, anchor) {
  if (!menu || !anchor) return () => {}

  // 先清掉上一次写在 style 上的值，才能从样式表读到设计上限
  menu.style.maxHeight = ''
  const declared = parseFloat(getComputedStyle(menu).maxHeight)
  const cap = Number.isFinite(declared) ? declared : Infinity

  const apply = () => {
    const row = rowHeight()
    const min = MIN_ROWS * row + CHROME
    const rect = anchor.getBoundingClientRect()
    const clip = clipOf(menu)
    const below = clip.bottom - rect.bottom - GAP
    const above = rect.top - clip.top - GAP

    if (below >= cap) {
      // 放得下就别折腾，保持样式表原样
      menu.classList.remove('is-above')
      menu.style.maxHeight = ''
      return
    }

    const flip = above > below
    // 向下取整到整行：宁可少露一行，也不要露半行被切开的样子
    const room = Math.max(min, Math.floor((Math.min(cap, flip ? above : below) - CHROME) / row) * row + CHROME)
    menu.classList.toggle('is-above', flip)
    menu.style.maxHeight = `${Math.round(room)}px`
  }

  apply()
  window.addEventListener('scroll', apply, true)
  window.addEventListener('resize', apply)

  return () => {
    window.removeEventListener('scroll', apply, true)
    window.removeEventListener('resize', apply)
    menu.classList.remove('is-above')
    menu.style.maxHeight = ''
  }
}
