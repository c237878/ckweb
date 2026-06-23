<template>
  <div class="series-detail" v-if="series">
    <div class="series-header">
      <div class="series-info">
        <h1>{{ series.name }}</h1>
        <p v-if="series.alias">别名：{{ series.alias }}</p>
        <p v-if="series.country">地区：{{ series.country }}</p>
        <p v-if="series.link"><a :href="series.link" target="_blank">链接 →</a></p>
      </div>
    </div>
    <div class="series-videos">
      <h2>系列影片 ({{ videos.length }})</h2>
      <div class="video-grid">
        <VideoCard v-for="video in videos" :key="video.id" :video="video" mode="display" />
        <div v-if="videos.length === 0" class="empty-hint">暂无影片</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { seriesApi } from '@/scripts/api'
import VideoCard from '@/views/components/VideoCard.vue'

const route = useRoute()
const series = ref(null)
const videos = ref([])

onMounted(async () => {
  await loadSeries()
  await loadVideos()
})

const loadSeries = async () => {
  try {
    const res = await seriesApi.getDetail(route.params.id)
    if (res.success) {
      series.value = res.data
    }
  } catch (error) {
    console.error('加载系列详情失败:', error)
  }
}

const loadVideos = async () => {
  try {
    const res = await seriesApi.getVideos(route.params.id, { page: 1, pageSize: 50 })
    if (res.success) {
      videos.value = res.data || []
    }
  } catch (error) {
    console.error('加载系列影片失败:', error)
  }
}
</script>

<style scoped>
.series-detail {
  padding: 20px 0;
}

.series-header {
  margin-bottom: 40px;
}

.series-info h1 {
  font-size: 32px;
  margin-bottom: 10px;
}

.series-info p {
  margin: 5px 0;
  color: #666;
  font-size: 15px;
}

.series-info a {
  color: #3498db;
}

.series-videos h2 {
  margin-bottom: 20px;
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
