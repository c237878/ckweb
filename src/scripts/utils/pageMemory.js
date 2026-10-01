/**
 * "我看到第几页了"的本地记忆：按实体各自记一条（一位演员、一个系列各一份）。
 *
 * 演员页先做过一次，系列页是同一个诉求，所以收成一个共用小工具而不是再抄一遍：
 * 每页条数是设置里配的，页数纯粹是"翻到哪儿了"，两页的行为口径必须一致。
 *
 * 三条约定：
 *   · 只记大于 1 的页——第一页是常态，不值得占存储，顺手让"回到第一页"等于清掉记录；
 *   · 隐私模式 / 存储写满时算了，读不到就回第一页，不影响浏览；
 *   · 记下的页码可能因为删片或改了每页条数而越界，由各自的 loadXxx 收回到最后一页。
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
