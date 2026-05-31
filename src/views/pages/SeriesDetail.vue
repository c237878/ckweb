<template>
  <div class="series-detail" v-if="series">
    <h1>{{ series.name }}</h1>
    <div class="series-info">
      <p v-if="series.alias"><strong>别名:</strong> {{ series.alias }}</p>
      <p><strong>国家:</strong> {{ series.country }}</p>
    </div>
    <div class="series-videos">
      <h2>系列影片</h2>
      <div class="video-grid">
        <VideoCard v-for="video in videos" :key="video.id" :video="video" />
      </div>
      <div class="pagination" v-if="total > pageSize">
        <button :disabled="page === 1" @click="changePage(page - 1)">上一页</button>
        <span>第 {{ page }} 页</span>
        <button :disabled="page * pageSize >= total" @click="changePage(page + 1)">下一页</button>
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
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)

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
    const res = await seriesApi.getVideos(route.params.id, {
      page: page.value,
      pageSize: pageSize.value
    })
    if (res.success) {
      videos.value = res.data
      total.value = res.total
    }
  } catch (error) {
    console.error('加载系列影片失败:', error)
  }
}

const changePage = (newPage) => {
  page.value = newPage
  loadVideos()
}
</script>

<style scoped>
.series-detail {
  padding: 20px 0;
}

h1 {
  margin-bottom: 20px;
}

.series-info {
  margin-bottom: 40px;
}

.series-info p {
  margin: 10px 0;
  color: #666;
}

.description {
  margin-top: 20px;
  padding: 15px;
  background: #f5f5f5;
  border-radius: 8px;
}

.series-videos h2 {
  margin-bottom: 20px;
}

.video-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 20px;
}

.pagination button {
  padding: 8px 16px;
  background: #e74c3c;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.pagination button:disabled {
  background: #ccc;
  cursor: not-allowed;
}
</style>
