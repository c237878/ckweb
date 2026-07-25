<template>
  <div class="home">
    <!-- 顶部三个固定板块 -->
    <section v-for="sec in topSections" :key="sec.name" class="section">
      <div class="section-header">
        <h2 class="section-title">{{ sec.name }}</h2>
        <button v-if="sec.name === '今日推荐'" class="refresh-btn" @click="refreshDaily" :disabled="dailyRefreshing">{{ dailyRefreshing ? '加载中...' : '换一批' }}</button>
      </div>
      <div class="video-grid">
        <VideoCard v-for="video in sec.videos" :key="video.id" :video="video" mode="display" />
        <div v-if="sec.videos.length === 0" class="empty-hint">暂无内容</div>
      </div>
    </section>

    <!-- 分类展示（按配置显示） -->
    <section class="section" v-for="cat in categories" :key="cat.name">
      <h2 class="section-title">{{ cat.name }}</h2>
      <div class="video-grid">
        <VideoCard v-for="video in cat.videos" :key="video.id" :video="video" mode="display" />
        <div v-if="cat.videos.length === 0" class="empty-hint">暂无 {{ cat.name }} 影片</div>
      </div>
    </section>

    <div v-if="topSections.length === 0 && categories.length === 0" class="empty-hint" style="text-align:center;padding:60px">暂无影片</div>

    <!-- 悬浮日历 -->
    <div class="floating-calendar">
      <LikeCalendar />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { videoApi } from '@/scripts/api'
import VideoCard from '@/views/components/VideoCard.vue'
import LikeCalendar from '@/views/components/LikeCalendar.vue'

const topSections = ref([])
const categories = ref([])
const dailyRefreshing = ref(false)

onMounted(async () => {
  try {
    const metaRes = await videoApi.getMeta()
    if (!metaRes.success) return

    const count = parseInt(metaRes.homePageCategoryCount) || 12
    const homeCats = (metaRes.homePageCategories || '').split(',').map(s => s.trim()).filter(Boolean)

    // 并行加载：三个固定板块 + 分类
    const promises = [
      // 今日推荐
      videoApi.getDailyRecommend(count),
      // 最近点赞
      videoApi.getRecentlyLiked(count),
      // 高赞影片
      videoApi.getTopLiked(count)
    ]

    if (homeCats.length > 0) {
      // 有配置 → 只加载指定的分类
      homeCats.forEach(cat => promises.push(videoApi.getList({ pageIndex: 1, pageSize: count, category: cat, hasFile: true })))
    } else {
      // 无配置 → 加载全部分类
      const allCats = metaRes.categories || []
      allCats.forEach(cat => promises.push(videoApi.getList({ pageIndex: 1, pageSize: count, category: cat, hasFile: true })))
    }

    const results = await Promise.all(promises)
    const latestRes = results[0]
    const likedRes = results[1]
    const topRes = results[2]

    if (latestRes.success && latestRes.data?.length > 0)
      topSections.value.push({ name: '今日推荐', videos: latestRes.data })
    if (likedRes.success && likedRes.data?.length > 0)
      topSections.value.push({ name: '最近点赞', videos: likedRes.data })
    if (topRes.success && topRes.data?.length > 0)
      topSections.value.push({ name: '高赞影片', videos: topRes.data })

    const catResults = results.slice(3)
    if (homeCats.length > 0) {
      homeCats.forEach((cat, i) => {
        const res = catResults[i]
        if (res.success && res.data?.list?.length > 0)
          categories.value.push({ name: cat, videos: res.data.list })
      })
    } else {
      const allCats = metaRes.categories || []
      allCats.forEach((cat, i) => {
        const res = catResults[i]
        if (res.success && res.data?.list?.length > 0)
          categories.value.push({ name: cat, videos: res.data.list })
      })
    }
  } catch (error) {
    console.error('加载首页失败:', error)
  }
})

const refreshDaily = async () => {
  dailyRefreshing.value = true
  try {
    const metaRes = await videoApi.getMeta()
    const count = parseInt(metaRes.homePageCategoryCount) || 12
    const res = await videoApi.getDailyRecommend(count, true)
    if (res.success && res.data?.length > 0) {
      const idx = topSections.value.findIndex(s => s.name === '今日推荐')
      if (idx >= 0) {
        topSections.value[idx].videos = res.data
      }
    }
  } catch (e) {
    console.error('换一批失败:', e)
  }
  dailyRefreshing.value = false
}
</script>

<style scoped>
.home { padding: 20px 20px 60px; position: relative; }
.section-header { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
.refresh-btn { padding: 4px 14px; border: 1px solid #4a9eff; background: transparent; color: #4a9eff; border-radius: 4px; cursor: pointer; font-size: 13px; user-select: none; }
.refresh-btn:hover { background: #4a9eff; color: #fff; }
.refresh-btn:disabled { opacity: 0.6; cursor: not-allowed; }

.section { margin-bottom: 40px; }
.section-title {
  font-size: 24px;
  font-weight: bold;
  padding-left: 10px;
  border-left: 4px solid #e74c3c;
}
.video-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 20px;
}
.empty-hint { color: #999; font-size: 14px; padding: 20px; }

.floating-calendar {
  position: fixed;
  right: 20px;
  bottom: 20px;
  z-index: 100;
}
</style>
