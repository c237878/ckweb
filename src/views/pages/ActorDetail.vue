<template>
  <div class="actor-detail" v-if="actor">
    <div class="actor-header">
      <div class="actor-info">
        <h1>{{ actor.name }}</h1>
        <p v-if="actor.bio">{{ actor.bio }}</p>
      </div>
    </div>
    <div class="actor-videos">
      <h2>参演影片</h2>
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
.actor-detail {
  padding: 20px 0;
}

.actor-header {
  margin-bottom: 40px;
}

.actor-info h1 {
  font-size: 32px;
  margin-bottom: 10px;
}

.actor-info p {
  margin: 5px 0;
  color: #666;
  font-size: 15px;
}

.actor-videos h2 {
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
