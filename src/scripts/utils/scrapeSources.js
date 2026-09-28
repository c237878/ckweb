import { ref, watch } from 'vue'
import { actorApi } from '@/scripts/api'
import { ACTOR_SOURCE_FALLBACK } from '@/scripts/constants'

const KEY = 'actor_source_pick'

/**
 * 抓取来源：一份状态给两个入口用（演员列表的批量、详情相册的单位抓取）。
 *
 * 清单来自 GET /api/actor/scrape/sources —— 通道被停用的那个源后端已经滤掉：
 * 停用的东西还摆在列表里让人选，选完只能吃一句拒绝。
 * 冷却中 / 今日配额用满的源仍然在列表里，那是一会儿就自己好的状态，
 * 藏起来反而让人以为源没了，点下去会看到具体原因。
 *
 * 选过哪个记在 localStorage：每日配额会先刹车，一轮跑不完，下次进来还得是同一个源。
 */
const src = ref(localStorage.getItem(KEY) || ACTOR_SOURCE_FALLBACK[0].value)
const sources = ref([...ACTOR_SOURCE_FALLBACK])

watch(src, (v) => {
  try {
    localStorage.setItem(KEY, v)
  } catch {
    // 隐私模式下写不进去，记住只是省一次点击，不值得抛错
  }
})

export function useScrapeSources() {
  const load = async () => {
    try {
      const res = await actorApi.scrapeSources()
      if (!res.success) return
      const list = (res.data || []).map((x) => ({ value: x.key, label: x.label }))
      if (!list.length) return
      sources.value = list
      if (!list.some((x) => x.value === src.value)) src.value = list[0].value
    } catch (err) {
      // 拿不到清单就用兜底的那一个，抓取按钮不该因为这条请求挂掉
      console.error('加载抓取来源失败:', err)
    }
  }

  return { src, sources, load }
}
