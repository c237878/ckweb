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
 * 时长（秒）→ 人话。整片时长来自扫描读的 mvhd，没扫到时是 0/空，这时什么都不显示。
 * 不到一分钟的片子（预告片、GIF 类）也报出来，别显示成"0 分"看着像坏了。
 */
export function formatDuration(seconds) {
  const s = Number(seconds)
  if (!s || s <= 0) return ''
  const min = Math.round(s / 60)
  if (min < 1) return '不到 1 分'
  if (min < 60) return `${min} 分`
  return `${Math.floor(min / 60)} 小时 ${min % 60} 分`
}

/**
 * 后台任务的"还剩多久"：拿已完成的那部分推的，头一两个样本不准（调用方一般凑够 2 个才报）。
 * 扫描片源、搬移文件这类十分钟到小时级的活都要这句，所以只在这儿写一份。
 */
export function formatEta(seconds) {
  const s = Math.max(0, Math.round(Number(seconds) || 0))
  return s >= 60 ? `约剩 ${Math.round(s / 60)} 分钟` : `约剩 ${s} 秒`
}

/**
 * 容器里的 fourcc → 平时叫的那个名字。库里存的是原始 fourcc（不转写，见后端 SourceStates.Codecs 注释），
 * 所以只在显示这一层翻译；认不出的原样显示，别把看不懂的编码悄悄藏起来。
 */
const CODEC_LABELS = {
  avc1: 'H.264', avc3: 'H.264',
  hev1: 'H.265', hvc1: 'H.265', hev2: 'H.265', hvc2: 'H.265',
  av01: 'AV1', vp09: 'VP9',
  mp4v: 'MPEG-4', xvid: 'Xvid', dx50: 'DivX', divx: 'DivX'
}

export function codecLabel(fourcc) {
  const raw = (fourcc || '').trim()
  if (!raw) return ''
  return CODEC_LABELS[raw.toLowerCase()] || raw
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
