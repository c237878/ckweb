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

/** 拆日期：只写到位就退到年或年月，缺的部分留 0 */
const dateParts = (value) => {
  const m = /^(\d{4})(?:-(\d{1,2})(?:-(\d{1,2}))?)?/.exec(String(value || '').trim())
  return m ? { y: +m[1], mo: m[2] ? +m[2] : 0, d: m[3] ? +m[3] : 0 } : null
}

/** 秒 → 时:分:秒 / 分:秒。给"点赞时的播放位置"这类列用。
 *  没存过（null/undefined/空串）返回空串，调用方补占位符——
 *  Number(null) 是 0，不先挡一下老记录会显示成 0:00，看着像"片头就点了赞" */
export function formatClock(seconds) {
  if (seconds === null || seconds === undefined || seconds === '') return ''
  const n = Number(seconds)
  if (!Number.isFinite(n) || n < 0) return ''
  const h = Math.floor(n / 3600)
  const m = Math.floor((n % 3600) / 60)
  const s = Math.floor(n % 60)
  const mm = String(m).padStart(2, '0')
  const ss = String(s).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`
}

/**
 * 影片发行时这位演员多大：发行年 - 出生年，两边都精确到月日再按生日是否未到减 1。
 * 缺日期或算出负数/离谱值（抓取常见脏数据）返回 0，调用方按 0 不显示。
 */
export function ageAt(releaseDate, birthdate) {
  const r = dateParts(releaseDate)
  const b = dateParts(birthdate)
  if (!r || !b) return 0
  let age = r.y - b.y
  if (r.mo && b.mo && (r.mo < b.mo || (r.mo === b.mo && r.d && b.d && r.d < b.d))) age -= 1
  return age > 0 && age < 90 ? age : 0
}
