<template>
  <div class="detail-page" v-if="actor">
    <div class="detail-header">
      <div class="header-row">
        <h1>{{ actor.name }}</h1>
        <span v-if="actor.country" class="country-tag">{{ actor.country }}</span>
      </div>
      <p v-if="actor.alias" class="alias-row">别名：{{ actor.alias }}</p>
      <p v-if="actor.bio" class="bio-row">{{ actor.bio }}</p>
    </div>
    <div class="detail-videos">
      <h2>参演影片 ({{ videos.length }})</h2>
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
import { actorApi } from '@/scripts/api'
import VideoCard from '@/views/components/VideoCard.vue'

const route = useRoute()
const actor = ref(null)
const videos = ref([])

onMounted(async () => {
  await loadActor()
  await loadVideos()
})

const loadActor = async () => {
  try {
    const res = await actorApi.getDetail(route.params.id)
    if (res.success) {
      actor.value = res.data
    }
  } catch (error) {
    console.error('加载演员详情失败:', error)
  }
}

const loadVideos = async () => {
  try {
    const res = await actorApi.getVideos(route.params.id, { page: 1, pageSize: 50 })
    if (res.success) {
      videos.value = res.data || []
    }
  } catch (error) {
    console.error('加载演员影片失败:', error)
  }
}
</script>

<style scoped>
.detail-page {
  padding: 20px 0;
}

.detail-header {
  margin-bottom: 40px;
}

.header-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
}

.header-row h1 {
  font-size: 32px;
  margin: 0;
}

.country-tag {
  background: #f3e5f5;
  color: #7b1fa2;
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 13px;
}

.alias-row {
  margin: 8px 0;
  color: #666;
  font-size: 15px;
}

.bio-row {
  margin: 12px 0 0;
  color: #444;
  font-size: 15px;
  line-height: 1.6;
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
