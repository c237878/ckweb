/**
 * 详情页"我在这儿"的本地记忆：页码与片源三维筛选，按实体各自记一条（一位演员、一个系列各一份）。
 *
 * 演员页先做过一次页码，系列页接着提了同样的诉求，两处行为必须一致，所以收成这一份而不是各写一遍。
 *
 * 三条约定：
 *   · 只记"非默认"的状态——页码只记大于 1 的（回到第一页等于清掉记录），
 *     筛选只在确实筛了什么的时候存（三维全空等于没记忆）；
 *   · 隐私模式 / 存储写满时算了，读不到就按默认来，不影响浏览；
 *   · 记下的页码可能因为删片或改了每页条数而越界，由各自的 loadVideos 收回到最后一页。
 *
 * 键名由调用方给全（如 `actor_videos_page_${id}`），这里只加 `ckweb_` 前缀，
 * 这样已有条目不会因为重构而失效。
 */

const PREFIX = 'ckweb_'

export function rememberedPage(key) {
  try {
    const n = parseInt(localStorage.getItem(PREFIX + key) || '', 10)
    return n > 1 ? n : 1
  } catch {
    return 1
  }
}

export function rememberPage(key, n) {
  try {
    if (n > 1) localStorage.setItem(PREFIX + key, String(n))
    else localStorage.removeItem(PREFIX + key)
  } catch {
    /* 写不进去也一样记住这一屏，只是下次进来回到第一页 */
  }
}

/** 读回筛选状态：只认这块面板自己有的维度，值也必须是标量——存的东西不该反过来给界面加字段 */
export function rememberedFilter(key, shape) {
  const blank = { ...shape }
  try {
    const raw = localStorage.getItem(PREFIX + key)
    if (!raw) return blank
    const saved = JSON.parse(raw)
    for (const dim of Object.keys(blank)) {
      const v = saved?.[dim]
      if (typeof v === 'string' || typeof v === 'number') blank[dim] = String(v)
    }
  } catch {
    /* 读不到或坏了都按没筛处理 */
  }
  return blank
}

export function rememberFilter(key, state) {
  try {
    if (isBlankFilter(state)) localStorage.removeItem(PREFIX + key)
    else localStorage.setItem(PREFIX + key, JSON.stringify(state))
  } catch {
    /* 同上：存不进去不影响这次浏览 */
  }
}

export const isBlankFilter = (state) =>
  Object.values(state || {}).every((v) => v === '' || v === null || v === undefined)

/**
 * 逐维比一下。赋值前先问这一句是必要的：`sourceFilter.value = {...}` 即使内容一模一样
 * 也是换了引用，deep watcher 会照样跑一遍"筛选变了 → 回第一页重取"，
 * 表现就是切实体时先回第一页、又跳回记下的那一页，闪一下。
 */
export const sameFilter = (a, b) => {
  const ka = Object.keys(a || {}), kb = Object.keys(b || {})
  if (ka.length !== kb.length) return false
  return ka.every((k) => a[k] === b[k])
}
