<template>
  <div class="like-calendar" :class="{ collapsed: collapsed }">
    <!-- 头部 -->
    <div class="cal-header" @click="collapsed && (collapsed = false)">
      <div class="cal-title">
        <span class="cal-icon">📅</span>
        <span>观影日历</span>
      </div>
      <button class="toggle-btn" @click.stop="collapsed = !collapsed" :title="collapsed ? '展开' : '收起'">
        {{ collapsed ? '▶' : '◀' }}
      </button>
    </div>

    <!-- 日历主体 -->
    <div class="cal-body" v-if="!collapsed">
      <!-- 月份切换 -->
      <div class="month-nav">
        <button class="nav-btn" @click="prevMonth">◀</button>
        <span class="month-label">{{ currentYear }}年{{ currentMonth }}月</span>
        <button class="nav-btn" @click="nextMonth">▶</button>
      </div>

      <!-- 统计摘要 -->
      <div class="stats-row">
        <div class="stat-item">
          <span class="stat-label">本月</span>
          <span class="stat-value red">{{ stats.monthTotal }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">历史</span>
          <span class="stat-value">{{ stats.total }}</span>
        </div>
      </div>

      <!-- 星期头部 -->
      <div class="weekdays">
        <span v-for="d in ['日','一','二','三','四','五','六']" :key="d">{{ d }}</span>
      </div>

      <!-- 日期网格 -->
      <div class="days-grid">
        <!-- 空白填充 -->
        <div v-for="n in firstDayOffset" :key="'blank'+n" class="day-cell blank"></div>
        <!-- 日期 -->
        <div
          v-for="day in stats.monthDays"
          :key="day"
          class="day-cell"
          :class="getDayClass(day)"
          :title="getDayTitle(day)"
        >
          <span class="day-num">{{ day }}</span>
          <span v-if="getDayCount(day) > 0" class="day-count">{{ getDayCount(day) }}</span>
        </div>
      </div>

      <!-- 月度趋势 -->
      <div class="monthly-trend" v-if="stats.monthly?.length">
        <div class="trend-title">近12月趋势</div>
        <div class="trend-bars">
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
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { videoApi } from '@/scripts/api'

const collapsed = ref(true)
const currentYear = ref(new Date().getFullYear())
const currentMonth = ref(new Date().getMonth() + 1)
const stats = ref({
  daily: {},
  monthTotal: 0,
  monthDays: 30,
  total: 0,
  monthly: []
})

// 计算当月1号是星期几（0=周日）
const firstDayOffset = computed(() => {
  return new Date(currentYear.value, currentMonth.value - 1, 1).getDay()
})

// 获取某天的点赞数
const getDayCount = (day) => {
  const key = `${currentYear.value}-${String(currentMonth.value).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  return stats.value.daily[key] || 0
}

// 获取当天样式类
const getDayClass = (day) => {
  const cnt = getDayCount(day)
  if (cnt === 0) return ''
  if (cnt >= 5) return 'heat-high'
  if (cnt >= 3) return 'heat-mid'
  return 'heat-low'
}

const getDayTitle = (day) => {
  const cnt = getDayCount(day)
  if (cnt === 0) return ` ${day}日: 无点赞`
  return ` ${day}日: ${cnt}次点赞`
}

// 趋势图最高值
const maxMonthlyCount = computed(() => {
  if (!stats.value.monthly?.length) return 1
  return Math.max(...stats.value.monthly.map(m => m.count), 1)
})

const getBarHeight = (count) => {
  return Math.max(4, Math.round((count / maxMonthlyCount.value) * 40))
}

const loadStats = async () => {
  try {
    const res = await videoApi.getLikeStats(currentYear.value, currentMonth.value)
    if (res.success) {
      stats.value = res
    }
  } catch (e) {
    console.error('加载点赞统计失败:', e)
  }
}

const prevMonth = () => {
  if (currentMonth.value === 1) {
    currentMonth.value = 12
    currentYear.value--
  } else {
    currentMonth.value--
  }
  loadStats()
}

const nextMonth = () => {
  if (currentMonth.value === 12) {
    currentMonth.value = 1
    currentYear.value++
  } else {
    currentMonth.value++
  }
  loadStats()
}

onMounted(() => {
  loadStats()
})
</script>

<style scoped>
.like-calendar {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.15);
  overflow: hidden;
  width: 240px;
  flex-shrink: 0;
  transition: width 0.3s ease, height 0.3s ease;
}

.like-calendar.collapsed {
  width: 48px;
  border-radius: 24px;
}

.cal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: linear-gradient(135deg, #e74c3c, #c0392b);
  color: #fff;
}

.cal-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: bold;
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
}

.collapsed .cal-title span:last-child {
  display: none;
}

.collapsed .cal-header {
  justify-content: center;
  cursor: pointer;
  padding: 10px;
}

.toggle-btn {
  background: rgba(255,255,255,0.2);
  border: none;
  color: #fff;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 11px;
  flex-shrink: 0;
}

.collapsed .toggle-btn {
  display: none;
}

.collapsed .cal-icon {
  margin: 0;
  font-size: 20px;
}

.cal-body {
  padding: 12px;
}

.month-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.nav-btn {
  background: #f0f0f0;
  border: none;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  color: #666;
}

.nav-btn:hover {
  background: #e0e0e0;
}

.month-label {
  font-size: 13px;
  font-weight: bold;
  color: #333;
}

.stats-row {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.stat-item {
  flex: 1;
  background: #f9f9f9;
  border-radius: 8px;
  padding: 8px 6px;
  text-align: center;
}

.stat-label {
  display: block;
  font-size: 11px;
  color: #999;
  margin-bottom: 2px;
}

.stat-value {
  font-size: 18px;
  font-weight: bold;
  color: #333;
}

.stat-value.red {
  color: #e74c3c;
}

.weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  text-align: center;
  margin-bottom: 4px;
}

.weekdays span {
  font-size: 11px;
  color: #999;
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
  border-radius: 4px;
  cursor: default;
}

.day-cell.blank {
  background: transparent;
}

.day-num {
  font-size: 12px;
  color: #555;
}

.day-count {
  font-size: 9px;
  color: #fff;
  background: #e74c3c;
  border-radius: 8px;
  padding: 0 3px;
  line-height: 14px;
  margin-top: 1px;
}

/* 热度颜色 */
.heat-low { background: #fde8e6; }
.heat-mid { background: #f5a89a; }
.heat-high { background: #e74c3c; }
.heat-high .day-num { color: #fff; }
.heat-high .day-count { background: rgba(255,255,255,0.9); color: #e74c3c; }

/* 趋势图 */
.monthly-trend {
  margin-top: 12px;
  border-top: 1px solid #eee;
  padding-top: 10px;
}

.trend-title {
  font-size: 11px;
  color: #999;
  margin-bottom: 8px;
}

.trend-bars {
  display: flex;
  align-items: flex-end;
  gap: 3px;
  height: 48px;
}

.trend-bar-wrap {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  height: 100%;
  justify-content: flex-end;
}

.trend-bar {
  width: 100%;
  background: #f5a89a;
  border-radius: 2px 2px 0 0;
  min-height: 3px;
  transition: height 0.3s ease;
}

.trend-bar.active {
  background: #e74c3c;
}

.trend-label {
  font-size: 9px;
  color: #bbb;
}
</style>
