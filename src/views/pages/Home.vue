<template>
  <div class="home">
    <!-- 按分类展示 -->
    <section class="section" v-for="cat in categories" :key="cat.name">
      <h2 class="section-title">{{ cat.name }}</h2>
      <div class="video-grid">
        <VideoCard v-for="video in cat.videos" :key="video.id" :video="video" mode="display" />
        <div v-if="cat.videos.length === 0" class="empty-hint">暂无影片</div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { videoApi } from '@/scripts/api'
import VideoCard from '@/views/components/VideoCard.vue'

const categories = ref([
  { name: '电影', value: '电影', videos: [] },
  { name: '电视剧', value: '电视剧', videos: [] },
  { name: '动漫', value: '动漫', videos: [] },
  { name: '其他', value: '其他', videos: [] }
])

onMounted(async () => {
  await Promise.all(categories.value.map(async (cat) => {
    try {
      const res = await videoApi.getList({ pageIndex: 1, pageSize: 12, category: cat.value })
      if (res.success) {
        cat.videos = res.data.list || []
      }
    } catch (error) {
      console.error(`加载${cat.name}失败:`, error)
    }
  }))
})
</script>

<style scoped>
.home {
  padding: 20px 0;
}

.section {
  margin-bottom: 40px;
}

.section-title {
  font-size: 24px;
  font-weight: bold;
  margin-bottom: 20px;
  padding-left: 10px;
  border-left: 4px solid #e74c3c;
}

.video-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 20px;
}

.empty-hint {
  color: #999;
  font-size: 14px;
  padding: 20px;
}
</style>
