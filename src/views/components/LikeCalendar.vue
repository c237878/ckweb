<template>
  <!--
    悬浮件：窄屏（<900px）默认收成右下角圆钮，避免整块面板压住正文和按钮。
    宽屏维持原来的折叠条：点一下展开，再点收回。
  -->
  <button
    v-if="isNarrow && collapsed"
    type="button"
    class="cal-fab"
    aria-label="打开观影日历"
    :aria-expanded="false"
    @click="collapsed = false"
  >
    <svg class="cal-svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
      <path d="M8 3v4M16 3v4M3.5 10h17" />
    </svg>
    <span v-if="stats.monthTotal" class="fab-badge">{{ stats.monthTotal }}</span>
  </button>

  <section v-else class="like-calendar" :class="{ 'is-collapsed': collapsed }">
    <!-- 折叠态：整条即按钮 -->
    <button
      v-if="collapsed"
      type="button"
      class="cal-pill"
      aria-label="展开观影日历"
      :aria-expanded="false"
      @click="collapsed = false"
    >
      <svg class="cal-svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
        <path d="M8 3v4M16 3v4M3.5 10h17" />
      </svg>
    </button>

    <template v-else>
      <div class="cal-header">
        <span class="cal-title">
          <svg class="cal-svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
            <path d="M8 3v4M16 3v4M3.5 10h17" />
          </svg>
          <span>观影日历</span>
        </span>
        <button
          type="button"
          class="toggle-btn"
          :aria-expanded="true"
          @click="collapsed = true"
        >
          <span aria-hidden="true">×</span>
        </button>
      </div>

      <div class="cal-body" :aria-busy="loading ? 'true' : 'false'">
        <!-- 月份切换 -->
        <div class="month-nav">
          <button type="button" class="nav-btn" aria-label="上一月" :disabled="!canPrev" @click="prevMonth">
            <span aria-hidden="true">‹</span>
          </button>
          <span class="month-label">{{ currentYear }}年{{ currentMonth }}月</span>
          <button type="button" class="nav-btn" aria-label="下一月" :disabled="!canNext" @click="nextMonth">
            <span aria-hidden="true">›</span>
          </button>
        </div>

        <div v-if="loading" class="skeletons">
          <div v-for="n in 3" :key="n" class="skeleton stat-skeleton"></div>
        </div>

        <p v-else-if="error" class="notice notice--error">
          {{ error }}
          <button type="button" class="btn btn--sm" @click="loadStats">重试</button>
        </p>

        <template v-else>
          <!-- 统计摘要 -->
          <div class="stats-row">
            <div class="stat-item">
              <span class="stat-label">本月</span>
              <span class="stat-value like">{{ stats.monthTotal }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">历史</span>
              <span class="stat-value">{{ stats.total }}</span>
            </div>
            <div v-if="daysSinceLastLike !== null" class="stat-item">
              <span class="stat-label">距上次</span>
              <span class="stat-value" :class="{ warn: daysSinceLastLike >= 7 }">{{ daysSinceLastLike }}天</span>
            </div>
          </div>

          <!-- 日期网格 -->
          <div class="weektables">
            <div class="weekdays">
              <span v-for="d in WEEKDAYS" :key="d">{{ d }}</span>
            </div>
            <div class="days-grid">
              <div v-for="n in firstDayOffset" :key="'head' + n" class="day-cell blank"></div>
              <div v-for="day in stats.monthDays" :key="day" class="day-cell" :class="getDayClass(day)">
                <span class="day-num">{{ day }}</span>
                <span v-if="getDayCount(day) > 0" class="day-count">{{ getDayCount(day) }}</span>
              </div>
              <div v-for="n in lastDayOffset" :key="'tail' + n" class="day-cell blank"></div>
            </div>
          </div>

          <!-- 热度图例：颜色不能是唯一的信息载体 -->
          <div class="legend">
            <span class="legend-item"><i class="swatch"></i>无</span>
            <span class="legend-item"><i class="swatch heat-low"></i>1-2</span>
            <span class="legend-item"><i class="swatch heat-mid"></i>3-4</span>
            <span class="legend-item"><i class="swatch heat-high"></i>5+</span>
          </div>

          <!-- 月度趋势 -->
          <div v-if="stats.monthly?.length" class="monthly-trend">
            <div class="trend-title">近12月趋势({{ pastYearCount }}次)</div>
            <p class="sr-only">{{ monthlySummary }}</p>
            <div class="trend-bars" aria-hidden="true">
              <div
                v-for="m in stats.monthly"
                :key="m.year + '-' + m.month"
                class="trend-bar-wrap"
                :title="`${m.year}年${m.month}月: ${m.count}次`"
              >
                <div
                  class="trend-bar"
                  :style="{ height: getBarHeight(m.count) + 'px' }"
                  :class="{ active: m.year === currentYear && m.month === currentMonth }"
                ></div>
                <span class="trend-label">{{ m.month }}</span>
                <span class="trend-count">{{ m.count }}</span>
              </div>
            </div>
          </div>
        </template>
      </div>
    </template>
  </section>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { videoApi } from '@/scripts/api'

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

/** App.vue 在 900px 处收紧悬浮件外边距，这里用同一断点决定收起形态 */
const NARROW_QUERY = '(max-width: 900px)'
const media = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(NARROW_QUERY) : null

const isNarrow = ref(media ? media.matches : false)
const collapsed = ref(true)
const currentYear = ref(new Date().getFullYear())
const currentMonth = ref(new Date().getMonth() + 1)
const loading = ref(true)
const error = ref('')
const stats = ref({
  daily: {},
  monthTotal: 0,
  monthDays: 30,
  total: 0,
  monthly: []
})

// 柱状图对读屏没意义，改念一句摘要
const monthlySummary = computed(() => {
  const list = stats.value?.monthly
  if (!Array.isArray(list) || !list.length) return ''
  return '近12个月点赞：' + list.map((m) => `${m.year}年${m.month}月 ${m.count} 次`).join('，')
})

// 最近12个月的点赞总数
const pastYearCount = computed(() => {
  const list = stats.value?.monthly
  if (!Array.isArray(list)) return 0
  return list.reduce((sum, item) => sum + (item.count || 0), 0)
})

// 距离上次点赞过去多少天
const daysSinceLastLike = computed(() => {
  if (!stats.value.lastLikeDate) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const lastDate = new Date(stats.value.lastLikeDate)
  lastDate.setHours(0, 0, 0, 0)
  return Math.floor((today - lastDate) / 86400000)
})

// 当月1号是星期几（0=周日），用于补前面的空格
const firstDayOffset = computed(() => new Date(currentYear.value, currentMonth.value - 1, 1).getDay())

// 固定 42 格，补满后剩余的尾巴
const lastDayOffset = computed(() => 42 - firstDayOffset.value - (stats.value.monthDays || 30))

const getDayCount = (day) => {
  const daily = stats.value.daily || {}
  const key = `${currentYear.value}-${String(currentMonth.value).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  return daily[key] || 0
}

// 热度分档：无 / 1-2 / 3-4 / 5+
const getDayClass = (day) => {
  const today = new Date()
  const isToday =
    currentYear.value === today.getFullYear() &&
    currentMonth.value === today.getMonth() + 1 &&
    day === today.getDate()
  const cnt = getDayCount(day)
  const classes = []
  if (isToday) classes.push('today')
  if (cnt === 0) return classes.join(' ')
  classes.push(cnt >= 5 ? 'heat-high' : cnt >= 3 ? 'heat-mid' : 'heat-low')
  return classes.join(' ')
}

const maxMonthlyCount = computed(() => {
  if (!stats.value.monthly?.length) return 1
  return Math.max(...stats.value.monthly.map((m) => m.count), 1)
})

const getBarHeight = (count) => Math.max(4, Math.round((count / maxMonthlyCount.value) * 40))

const loadStats = async () => {
  loading.value = true
  error.value = ''
  try {
    const res = await videoApi.getLikeStats(currentYear.value, currentMonth.value)
    if (res.success) {
      stats.value = res
    } else {
      error.value = res.message || '统计加载失败'
    }
  } catch (e) {
    console.error('加载点赞统计失败:', e)
    error.value = '统计加载失败'
  } finally {
    loading.value = false
  }
}

// 最早2025年5月，最晚当前月
const MIN_YEAR = 2025
const MIN_MONTH = 5
const canPrev = computed(
  () => currentYear.value > MIN_YEAR || (currentYear.value === MIN_YEAR && currentMonth.value > MIN_MONTH)
)
const canNext = computed(() => {
  const now = new Date()
  return (
    currentYear.value < now.getFullYear() ||
    (currentYear.value === now.getFullYear() && currentMonth.value < now.getMonth() + 1)
  )
})

const shiftMonth = (delta) => {
  if (delta < 0 && !canPrev.value) return
  if (delta > 0 && !canNext.value) return
  const next = currentMonth.value + delta
  if (next < 1) {
    currentMonth.value = 12
    currentYear.value--
  } else if (next > 12) {
    currentMonth.value = 1
    currentYear.value++
  } else {
    currentMonth.value = next
  }
  loadStats()
}

const prevMonth = () => shiftMonth(-1)
const nextMonth = () => shiftMonth(1)

// 回到宽屏时收回折叠条，免得面板一直占着右下角
const handleMediaChange = (e) => {
  isNarrow.value = e.matches
  if (!e.matches) collapsed.value = true
}

// 点赞发生在别的页面（影片/漫画详情），日历得自己重取当天与月度统计
const handleLikesUpdated = () => loadStats()

onMounted(() => {
  media?.addEventListener('change', handleMediaChange)
  window.addEventListener('likesUpdated', handleLikesUpdated)
  loadStats()
})

onBeforeUnmount(() => {
  media?.removeEventListener('change', handleMediaChange)
  window.removeEventListener('likesUpdated', handleLikesUpdated)
})
</script>

<style scoped>
/* 悬浮圆钮（窄屏折叠态）：44px 触达面积，配色用强调色保证对比 */
.cal-fab {
  position: relative;
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  border-radius: var(--rp);
  background: var(--accent);
  color: var(--accent-ink);
  box-shadow: var(--shadow-2);
  transition: transform var(--dur) var(--ease), background var(--dur) var(--ease);
}

.cal-fab:hover {
  background: var(--accent-strong);
  transform: translateY(-1px);
}

.cal-fab .cal-svg {
  width: 24px;
  height: 24px;
}

.fab-badge {
  position: absolute;
  top: -2px;
  right: -2px;
  min-width: 18px;
  padding: 0 4px;
  border-radius: var(--rp);
  background: var(--like);
  color: var(--text-invert);
  font-size: var(--f-xs);
  font-weight: 700;
  line-height: 18px;
  box-shadow: 0 0 0 2px var(--bg);
}

/* 展开面板 */
.like-calendar {
  width: 260px;
  background: var(--bg-elev);
  border: 1px solid var(--border);
  border-radius: var(--r3);
  box-shadow: var(--shadow-3);
  overflow: hidden;
}

.like-calendar.is-collapsed {
  width: 48px;
  border-radius: var(--rp);
}

/* 折叠条（宽屏）：整条即按钮 */
.cal-pill {
  display: grid;
  place-items: center;
  width: 100%;
  height: 48px;
  background: var(--bg-elev-2);
  color: var(--like);
}

.cal-pill:hover {
  background: var(--bg-hover);
}

.cal-pill .cal-svg {
  width: 22px;
  height: 22px;
}

.cal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--s2);
  padding: var(--s2) var(--s3);
  background: var(--bg-elev-2);
  border-bottom: 1px solid var(--border);
}

.cal-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: var(--f-md);
  font-weight: 700;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
}

.cal-title .cal-svg {
  width: 16px;
  height: 16px;
  color: var(--like);
  flex-shrink: 0;
}

.cal-svg {
  fill: none;
  stroke: currentColor;
  stroke-width: 1.7;
  stroke-linecap: round;
}

.toggle-btn {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border-radius: var(--r1);
  background: var(--bg-elev);
  border: 1px solid var(--border);
  color: var(--text-dim);
  font-size: var(--f-md);
  line-height: 1;
}

.toggle-btn:hover {
  background: var(--bg-hover);
  color: var(--text);
  border-color: var(--border-strong);
}

.cal-body {
  padding: var(--s3);
  display: flex;
  flex-direction: column;
  gap: var(--s2);
}

.month-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--s2);
}

.nav-btn {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border-radius: var(--r1);
  background: var(--bg-elev-2);
  border: 1px solid var(--border);
  color: var(--text-dim);
  font-size: var(--f-lg);
  line-height: 1;
}

.nav-btn:hover:not(:disabled) {
  background: var(--bg-hover);
  color: var(--text);
  border-color: var(--border-strong);
}

.nav-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.month-label {
  font-size: var(--f-sm);
  font-weight: 700;
  color: var(--text);
}

.skeletons {
  display: flex;
  gap: 6px;
}

.stat-skeleton {
  flex: 1;
  height: 48px;
  border-radius: var(--r1);
}

.stats-row {
  display: flex;
  gap: 6px;
}

.stat-item {
  flex: 1;
  background: var(--bg-elev-2);
  border-radius: var(--r1);
  padding: 6px 4px;
  text-align: center;
}

.stat-label {
  display: block;
  font-size: var(--f-xs);
  color: var(--text-dim);
}

.stat-value {
  font-size: var(--f-xl);
  font-weight: 700;
  color: var(--text);
  font-variant-numeric: tabular-nums;
}

.stat-value.like {
  color: var(--like);
}

/* 一周没点赞才提示，用强调金而不是原来的橙色 */
.stat-value.warn {
  color: var(--accent);
}

.weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  text-align: center;
}

.weekdays span {
  font-size: var(--f-xs);
  color: var(--text-dim);
  padding: 2px 0;
}

.days-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
}

.day-cell {
  position: relative;
  aspect-ratio: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-radius: var(--r1);
}

.day-cell.blank {
  background: transparent;
}

.day-num {
  font-size: var(--f-xs);
  color: var(--text-dim);
  font-variant-numeric: tabular-nums;
}

.day-count {
  font-size: 10px;
  font-weight: 700;
  line-height: 1.2;
  color: var(--text-dim);
}

/* 有热度的格子换成高对比文本色，保证压在色块上仍可读 */
.heat-low .day-num,
.heat-mid .day-num,
.heat-high .day-num,
.heat-low .day-count,
.heat-mid .day-count {
  color: var(--text);
}

.today {
  box-shadow: inset 0 0 0 1px var(--accent);
  font-weight: 700;
}

.today .day-num {
  color: var(--accent);
}

/* 热度三档：浅底 → 浅底描边 → 实底；实底上的字用反色墨 */
.heat-low {
  background: var(--like-soft);
}

.heat-mid {
  background: var(--like-soft);
  box-shadow: inset 0 0 0 1.5px var(--like);
}

.heat-high {
  background: var(--like);
}

.heat-high .day-num,
.heat-high .day-count {
  color: var(--text-invert);
}

.legend {
  display: flex;
  align-items: center;
  gap: var(--s2);
  font-size: var(--f-xs);
  color: var(--text-dim);
}

.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 3px;
}

.swatch {
  width: 10px;
  height: 10px;
  border-radius: 3px;
  background: var(--bg-elev-2);
  box-shadow: inset 0 0 0 1px var(--border);
}

.swatch.heat-low {
  background: var(--like-soft);
}

.swatch.heat-mid {
  background: var(--like-soft);
  box-shadow: inset 0 0 0 1.5px var(--like);
}

.swatch.heat-high {
  background: var(--like);
  box-shadow: none;
}

.monthly-trend {
  border-top: 1px solid var(--border);
  padding-top: var(--s2);
  display: flex;
  flex-direction: column;
  gap: var(--s2);
}

.trend-title {
  font-size: var(--f-xs);
  color: var(--text-dim);
}

.trend-bars {
  display: flex;
  align-items: flex-end;
  gap: 3px;
  height: 48px;
}

.trend-bar-wrap {
  position: relative;
  flex: 1;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  gap: 2px;
}

.trend-bar {
  width: 100%;
  min-height: 3px;
  border-radius: 3px 3px 0 0;
  background: var(--like);
  opacity: 0.35;
  transition: height var(--dur) var(--ease), opacity var(--dur) var(--ease);
}

.trend-bar.active {
  opacity: 1;
}

.trend-label {
  font-size: 10px;
  color: var(--text-dim);
  font-variant-numeric: tabular-nums;
}

.trend-count {
  position: absolute;
  top: 25%;
  font-size: 10px;
  color: var(--text);
  font-variant-numeric: tabular-nums;
}

/* 窄屏展开：限制宽高，超出滚动，不再压满整屏 */
@media (max-width: 900px) {
  .like-calendar {
    width: min(300px, calc(100vw - var(--s6)));
  }

  .cal-body {
    max-height: calc(100vh - 160px);
    overflow-y: auto;
  }
}
</style>
