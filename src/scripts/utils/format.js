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
