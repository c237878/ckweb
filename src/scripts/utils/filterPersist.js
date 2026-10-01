// 浏览状态持久化：页码、筛选条件这些"我在这儿"的信息。
//
// 这里有两层用法，选哪层看状态是"整页一份"还是"每条记录一份"：
//   · loadFilterState / saveFilterState —— 列表页（系列列表、合集列表、点赞列表）用，
//     一整块界面状态存一个键，读出来是什么就是什么；
//   · rememberedPage / rememberPage / rememberedFilter / rememberFilter —— 详情页
//     （演员、系列）用，同一类页面下有几百个实体，得按实体各存一条，而且要"只存非默认"，
//     否则几百条没人看的空状态会把 localStorage 填满。
// 两套都在这个文件里，是为了让"我们怎么持久化浏览状态"只有一个地方可查、也只有一份实现。

const PREFIX = 'ck_filter_'

/**
 * 从 localStorage 恢复筛选状态
 * @param {string} key - 页面标识（如 'video-list'）
 * @returns {object|null} 恢复的状态，或 null（首次访问）
 */
export function loadFilterState(key) {
    try {
        const raw = localStorage.getItem(PREFIX + key)
        return raw ? JSON.parse(raw) : null
    } catch {
        return null
    }
}

/**
 * 将筛选状态保存到 localStorage
 * @param {string} key - 页面标识
 * @param {object} state - 要保存的状态（会与旧状态深度合并）
 */
export function saveFilterState(key, state) {
    try {
        localStorage.setItem(PREFIX + key, JSON.stringify(state))
    } catch (e) {
        console.warn('saveFilterState failed:', e)
    }
}

/**
 * 详情页那一层：一位演员、一个系列各存自己的"看到第几页 / 按哪一筛看"。
 *
 * 与上面那层的三点不同，都是刻意的：
 *   · 只存非默认状态——回到第一页、选回"全部"都等于清掉这条记录，存储不会被一堆默认值灌满；
 *   · 键名由调用方给全（如 `actor_videos_page_${id}`），只加 `ckweb_` 前缀；
 *     这个前缀是演员页先用起来的，改了就等于把已有的记忆丢掉，所以留在这里不走 `ck_filter_`；
 *   · 读回来的东西要验：存坏了、或者多出来的键，一律当没这个状态，不让存储反过来教界面加字段。
 *
 * 隐私模式 / 存储写满时读写都静默失败：大不了下次进来回到第一页，不影响这次浏览。
 */
const DETAIL_PREFIX = 'ckweb_'

export function rememberedPage(key) {
  try {
    const n = parseInt(localStorage.getItem(DETAIL_PREFIX + key) || '', 10)
    return n > 1 ? n : 1
  } catch {
    return 1
  }
}

export function rememberPage(key, n) {
  try {
    if (n > 1) localStorage.setItem(DETAIL_PREFIX + key, String(n))
    else localStorage.removeItem(DETAIL_PREFIX + key)
  } catch {
    /* 写不进去也一样记住这一屏 */
  }
}

/** 读回筛选状态：只认 shape 里有的维度，值也必须是标量 */
export function rememberedFilter(key, shape) {
  const blank = { ...shape }
  try {
    const raw = localStorage.getItem(DETAIL_PREFIX + key)
    if (!raw) return blank
    const saved = JSON.parse(raw)
    for (const dim of Object.keys(blank)) {
      const v = saved?.[dim]
      if (typeof v === 'string' || typeof v === 'number') blank[dim] = String(v)
    }
  } catch {
    /* 坏了就按没筛处理 */
  }
  return blank
}

export function rememberFilter(key, state) {
  try {
    if (isBlankFilter(state)) localStorage.removeItem(DETAIL_PREFIX + key)
    else localStorage.setItem(DETAIL_PREFIX + key, JSON.stringify(state))
  } catch {
    /* 同上 */
  }
}

export const isBlankFilter = (state) =>
  Object.values(state || {}).every((v) => v === '' || v === null || v === undefined)

/**
 * 赋值前先比一下：`filter.value = {...}` 即使内容一模一样也是换了引用，
 * deep watcher 会照样跑一遍"筛选变了 → 回第一页重取"，
 * 表现就是切实体时先回第一页、又跳回记下的那一页，闪一下。
 */
export const sameFilter = (a, b) => {
  const ka = Object.keys(a || {}), kb = Object.keys(b || {})
  if (ka.length !== kb.length) return false
  return ka.every((k) => a[k] === b[k])
}
