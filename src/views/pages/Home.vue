<template>
  <div class="home">
    <section class="section" v-for="cat in categories" :key="cat.name">
      <h2 class="section-title">{{ cat.name }}</h2>
      <div class="video-grid">
        <VideoCard v-for="video in cat.videos" :key="video.id" :video="video" mode="display" />
        <div v-if="cat.videos.length === 0" class="empty-hint">暂无 {{ cat.name }} 影片</div>
      </div>
    </section>
    <div v-if="categories.length === 0" class="empty-hint" style="text-align:center;padding:60px">暂无影片</div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { videoApi } from '@/scripts/api'
import VideoCard from '@/views/components/VideoCard.vue'

const categories = ref([])

onMounted(async () => {
  try {
    // 先获取所有已有的分类
    const metaRes = await videoApi.getMeta()
    if (!metaRes.success || !metaRes.categories?.length) return

    // 并行加载每个分类的视频
    await Promise.all(metaRes.categories.map(async (catName) => {
      const res = await videoApi.getList({ pageIndex: 1, pageSize: 12, category: catName })
      if (res.success) {
        categories.value.push({ name: catName, value: catName, videos: res.data?.list || [] })
      }
    }))
  } catch (error) {
    console.error('加载首页失败:', error)
  }
})
</script>

<style scoped>
.home { padding: 20px 0; }
.section { margin-bottom: 40px; }
.section-title { font-size: 24px; font-weight: bold; margin-bottom: 20px; padding-left: 10px; border-left: 4px solid #e74c3c; }
.video-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 20px; }
.empty-hint { color: #999; font-size: 14px; padding: 20px; }
</style>