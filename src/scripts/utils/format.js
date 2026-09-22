// 通用格式化函数

/**
 * 格式化文件大小（字节数 → 人类可读）
 * @param {number} bytes - 字节数
 * @returns {string} 如 "1.5 GB"
 */
export function formatSize(bytes) {
  if (!bytes) return ''
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0
  while (bytes >= 1024 && i < units.length - 1) {
    bytes /= 1024
    i++
  }
  return bytes.toFixed(1) + ' ' + units[i]
}

/**
 * 格式化后端时间。
 * 后端存的是 "yyyy-MM-dd HH:mm:ss" 本地时间字符串，直接丢给 new Date() 会按 UTC 解析再偏移，
 * 所以这里手工取字段。
 */
export function formatDate(value, withTime = false) {
  if (!value) return ''
  const matched = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(String(value).trim())
  if (!matched) return String(value)
  const [, y, m, d, hh, mm] = matched
  return withTime ? `${y}-${m}-${d} ${hh}:${mm}` : `${y}-${m}-${d}`
}
