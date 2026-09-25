/**
 * 全站共享的枚举与展示文案。
 * 片源两维的取值口径在后端 Utils/SourceStates.cs，两边必须一一对应；
 * 文案与配色只在这里写一份，页面里不要再各抄一遍。
 */

/**
 * 字幕情况。原先"字幕在不在"和"画面有没有广告"挤在一个 media_attr_flags 里，
 * 结果一格话说不清、也筛不准，现在拆成两维各自独立。
 *
 * pill = 卡片上的胶囊文案（未标不显示，所以是空串）
 * label = 筛选与标记按钮上的文案
 * long = 详情页与悬停提示里的完整说法
 */
export const SUBTITLE_STATES = {
  unknown: { pill: '', label: '未标记', long: '字幕情况还没标', tone: 'muted' },
  none: { pill: '无字幕版', label: '无字幕版', long: '发行版本就没字幕', tone: 'muted' },
  missing: { pill: '缺字幕', label: '缺字幕', long: '这片有字幕，这份没带上', tone: 'warn' },
  has: { pill: '有字幕', label: '有字幕', long: '字幕齐全（内嵌或同目录）', tone: 'success' }
}

/** 广告水印 */
export const WATERMARK_STATES = {
  unknown: { pill: '', label: '未标记', long: '广告水印还没标', tone: 'muted' },
  none: { pill: '无广告', label: '无广告', long: '画面干净，没有台标和广告', tone: 'success' },
  light: { pill: '角标水印', label: '角标水印', long: '角落有台标或小水印，不影响观看', tone: 'warn' },
  heavy: { pill: '满屏广告', label: '满屏广告', long: '片头广告、滚动或满屏水印，影响观看', tone: 'danger' }
}

const stateText = (states, state, long) => {
  const entry = states[state]
  if (!entry) return ''
  return long ? entry.long : entry.pill
}

const stateClass = (states, state) => {
  const entry = states[state]
  // 没有文案的（两维的"未标记"）不给胶囊类名，页面上就不画这一颗
  return entry && entry.pill ? `tag--${entry.tone}` : ''
}

export const subtitleText = (state, long = false) => stateText(SUBTITLE_STATES, state, long)
export const subtitleClass = (state) => stateClass(SUBTITLE_STATES, state)
export const watermarkText = (state, long = false) => stateText(WATERMARK_STATES, state, long)
export const watermarkClass = (state) => stateClass(WATERMARK_STATES, state)

const toOptions = (states) =>
  Object.entries(states)
    // 筛选与标记都从"有结论的"排起，未标记放最后：它是兜底项，不是常见目标
    .sort((a, b) => (a[0] === 'unknown' ? 1 : b[0] === 'unknown' ? -1 : 0))
    .map(([value, s]) => ({ value, label: s.label }))

export const SUBTITLE_OPTIONS = toOptions(SUBTITLE_STATES)
export const WATERMARK_OPTIONS = toOptions(WATERMARK_STATES)

/** 分辨率档位，与后端 Utils/SourceStates.cs 的 Resolutions 键一一对应 */
export const RESOLUTION_OPTIONS = [
  { value: '2160', label: '4K 及以上' },
  { value: '1080', label: '1080p' },
  { value: '720', label: '720p' },
  { value: '480', label: '480p' },
  { value: 'sd', label: '480p 以下' },
  { value: 'unscanned', label: '未扫描' }
]

/**
 * 卡片上的分辨率文案。按显示高（行数）报，所以 607×1080 这种非方形像素的片报 1080p；
 * 具体宽高在详情页原样给，这里只负责一眼能比出清晰度。
 */
export const resolutionText = (video) =>
  video && video.resH ? `${video.resH}p` : ''

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
  ],
  comic: [
    { value: '', label: '默认排序' },
    { value: 'name', label: '按名称' },
    { value: 'likes', label: '按点赞' }
  ]
}

/** 漫画连载状态：库里 comics.status，0=连载中 1=完结 */
export const COMIC_STATUS_OPTIONS = [
  { value: 0, label: '连载中' },
  { value: 1, label: '完结' }
]

/** 点赞记录的目标类型：video_likes.target_type */
export const LIKE_TARGET_OPTIONS = [
  { value: 'video', label: '影片' },
  { value: 'comic', label: '漫画' }
]

/**
 * 演员外链类型：actor_links.kind。
 * 取值必须与后端 Utils/Links.cs 的白名单一致，两边不一致会被静默归成 other。
 * profile = 女优资料站（javcup / av-wiki 这类），这批数据里占绝大多数
 */
export const LINK_KIND_OPTIONS = [
  { value: 'homepage', label: '个人主页' },
  { value: 'profile', label: '资料页' },
  { value: 'twitter', label: 'X / Twitter' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'other', label: '其他' }
]

export const linkKindLabel = (kind) =>
  LINK_KIND_OPTIONS.find((o) => o.value === kind)?.label || kind
