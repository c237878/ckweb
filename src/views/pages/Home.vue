<template>
  <div class="page home">
    <!-- 顶部三个固定板块 -->
    <section v-for="sec in topSections" :key="sec.name" class="section">
      <div class="section-head">
        <h2 class="section-title">{{ sec.name }}</h2>
        <button v-if="sec.name === '今日推荐'" class="btn btn--sm" @click="refreshDaily" :disabled="dailyRefreshing">
          {{ dailyRefreshing ? '加载中...' : '换一批' }}
        </button>
      </div>
      <div v-if="sec.videos.length" class="grid">
        <VideoCard v-for="video in sec.videos" :key="video.id" :video="video" />
      </div>
      <div v-else class="empty">暂无内容</div>
    </section>

    <!-- 分类展示（按配置显示） -->
    <section class="section" v-for="cat in categories" :key="cat.name">
      <div class="section-head">
        <h2 class="section-title">{{ cat.name }}</h2>
        <router-link class="btn btn--sm btn--ghost" :to="`/videos?category=${encodeURIComponent(cat.name)}`">查看全部</router-link>
      </div>
      <div v-if="cat.videos.length" class="grid">
        <VideoCard v-for="video in cat.videos" :key="video.id" :video="video" />
      </div>
      <div v-else class="empty">暂无 {{ cat.name }} 影片</div>
    </section>

    <div v-if="!loading && topSections.length === 0 && categories.length === 0" class="empty">
      暂无影片
    </div>
    <div v-if="error" class="notice notice--error">{{ error }}</div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { videoApi } from '@/scripts/api'
import { useAppStore } from '@/scripts/store/app'
import VideoCard from '@/views/components/VideoCard.vue'

const app = useAppStore()

const topSections = ref([])
const categories = ref([])
const dailyRefreshing = ref(false)
const loading = ref(true)
const error = ref('')

onMounted(async () => {
  try {
    // init() 幂等：App.vue 已触发过就不会重复请求设置
    await app.init()
    const count = app.homeCategoryCount

    // 4 个请求并发：分类板块走批量端点，不再按分类各发一次。
    // 用 allSettled，任一板块失败只让该板块空着，不会整页空白。
    const [daily, liked, top, sections] = await Promise.allSettled([
      videoApi.getDailyRecommend(count),
      videoApi.getRecentlyLiked(count),
      videoApi.getTopLiked(count),
      videoApi.getHomeSections()
    ]).then((rs) => rs.map((r) => (r.status === 'fulfilled' ? r.value : { success: false })))

    const tops = []
    if (daily.success && daily.data?.length) tops.push({ name: '今日推荐', videos: daily.data })
    if (liked.success && liked.data?.length) tops.push({ name: '最近点赞', videos: liked.data })
    if (top.success && top.data?.length) tops.push({ name: '高赞影片', videos: top.data })
    topSections.value = tops

    if (sections.success) {
      categories.value = (sections.data || [])
        .filter((item) => item.videos?.length)
        .map((item) => ({ name: item.category, videos: item.videos }))
    }
  } catch (err) {
    console.error('加载首页失败:', err)
    error.value = '首页数据加载失败，请检查后端服务是否可用'
  } finally {
    loading.value = false
  }
})

const refreshDaily = async () => {
  dailyRefreshing.value = true
  try {
    const res = await videoApi.getDailyRecommend(app.homeCategoryCount, true)
    if (res.success && res.data?.length) {
      const section = topSections.value.find((s) => s.name === '今日推荐')
      if (section) section.videos = res.data
    }
  } catch (e) {
    console.error('换一批失败:', e)
    error.value = '换一批失败'
  } finally {
    dailyRefreshing.value = false
  }
}
</script>

<style scoped>
.home {
  gap: var(--s6);
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--s3);
}
</style>
