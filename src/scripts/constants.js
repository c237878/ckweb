/**
 * 全站共享的枚举与展示文案。
 * 片源标记（media_attr_flags）此前在 5 处各写一份，文本与配色互不一致。
 */

export const MEDIA_FLAGS = {
  0: { short: '', long: '未标记', tone: 'muted' },
  1: { short: '劣质', long: '片源质量较差', tone: 'danger' },
  2: { short: '无字幕', long: '缺少字幕文件', tone: 'warn' },
  3: { short: '完美', long: '片源完整且有字幕', tone: 'success' }
}

export const mediaFlagText = (flags, long = false) => {
  const entry = MEDIA_FLAGS[flags]
  if (!entry) return ''
  return long ? entry.long : entry.short
}

export const mediaFlagClass = (flags) => (flags ? `tag--${MEDIA_FLAGS[flags]?.tone ?? 'muted'}` : '')

/** 列表排序选项，各列表页共用 */
export const SORT_OPTIONS = {
  video: [
    { value: '', label: '默认（最新入库优先）' },
    { value: 'code', label: '番号' },
    { value: 'name', label: '名称' },
    { value: 'likecount', label: '获赞数' }
  ],
  actor: [
    { value: '', label: '默认（获赞多优先）' },
    { value: 'name', label: '姓名' },
    { value: 'likecount', label: '获赞数' },
    { value: 'videocount', label: '影片数' }
  ],
  series: [
    { value: '', label: '默认（获赞多优先）' },
    { value: 'name', label: '名称' },
    { value: 'likecount', label: '获赞数' },
    { value: 'videocount', label: '影片数' }
  ]
}
