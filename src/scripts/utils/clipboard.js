/**
 * 复制一段文本。
 *
 * 留 execCommand 退路不是为了兼容老浏览器，是因为局域网 http 直连不是安全上下文，
 * 那种情况下 navigator.clipboard 直接不存在（VideoCard 复制番号早就踩过这个坑）。
 */
export async function copyText(text) {
  const value = String(text ?? '')
  if (!value) return false

  try {
    await navigator.clipboard.writeText(value)
    return true
  } catch {
    const ta = document.createElement('textarea')
    ta.value = value
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  }
}
