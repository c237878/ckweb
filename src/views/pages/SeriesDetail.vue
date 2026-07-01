<template>
  <div class="detail-page" v-if="series">
    <div class="detail-header">
      <div class="header-row">
        <h1>{{ series.name }}</h1>
        <span v-if="series.country" class="country-tag">{{ series.country }}</span>
        <span v-if="series.likeCount > 0" class="like-tag">♥ {{ series.likeCount }}</span>
        <button class="edit-btn" @click="openEditDialog">编辑</button>
      </div>
      <p v-if="series.alias" class="alias-row">别名：{{ series.alias }}</p>
      <p v-if="series.link" class="link-row">
        链接：<a :href="series.link" target="_blank">{{ decodeUrl(series.link) }}</a>
      </p>
    </div>
    <div class="detail-videos">
      <h2>系列影片 ({{ videos.length }})</h2>
      <div class="video-grid">
        <VideoCard v-for="video in videos" :key="video.id" :video="video" mode="display" />
        <div v-if="videos.length === 0" class="empty-hint">暂无影片</div>
      </div>
    </div>

    <AddSeriesDialog
      :visible="showEditDialog"
      :editingSeries="series"
      @save="onEditSave"
      @cancel="showEditDialog = false"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { seriesApi } from '@/scripts/api'
import VideoCard from '@/views/components/VideoCard.vue'
import AddSeriesDialog from '@/views/components/AddSeriesDialog.vue'

const route = useRoute()
const series = ref(null)
const videos = ref([])
const showEditDialog = ref(false)

const openEditDialog = () => {
  showEditDialog.value = true
}

const onEditSave = () => {
  showEditDialog.value = false
  loadSeries()
}

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

const loadAll = async () => {
  await loadSeries()
  await loadVideos()
}

onMounted(() => {
  loadAll()
})

// 监听路由参数变化
watch(
  () => route.params.id,
  (newId) => {
    if (newId) {
      loadAll()
    }
  }
)

// URL解码函数
const decodeUrl = (url) => {
  try {
    return decodeURIComponent(url)
  } catch {
    return url
  }
}
</script>

<style scoped>
.detail-page {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.detail-header {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.header-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.header-row h1 {
  font-size: 32px;
  margin: 0;
}

.edit-btn {
  background: none;
  border: 1px solid #ccc;
  border-radius: 4px;
  padding: 4px 12px;
  font-size: 13px;
  color: #666;
  cursor: pointer;
  transition: all 0.2s;
}

.edit-btn:hover {
  border-color: #3498db;
  color: #3498db;
}

.country-tag {
  background: #f3e5f5;
  color: #7b1fa2;
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 13px;
}

.like-tag {
  background: #fce4ec;
  color: #e74c3c;
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 13px;
}

.alias-row {
  color: #666;
  font-size: 15px;
}

.link-row {}

.link-row a {
  color: #3498db;
  font-size: 15px;
  word-break: break-all;
}

.detail-videos h2 {
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
