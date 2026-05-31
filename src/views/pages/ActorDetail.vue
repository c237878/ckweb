<template>
  <div class="actor-detail" v-if="actor">
    <div class="actor-header">
      <div class="actor-info">
        <h1>{{ actor.name }}</h1>
        <p v-if="actor.alias"><strong>别名:</strong> {{ actor.alias }}</p>
        <p><strong>国家:</strong> {{ actor.country }}</p>
      </div>
    </div>
    <div class="actor-videos">
      <h2>相关影片</h2>
      <div class="video-grid">
        <VideoCard v-for="video in videos" :key="video.id" :video="video" />
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
    const res = await actorApi.getVideos(route.params.id, { page: 1, pageSize: 20 })
    if (res.success) {
      videos.value = res.data
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
  display: flex;
  gap: 30px;
  margin-bottom: 40px;
}

.actor-avatar {
  width: 250px;
  height: 300px;
  border-radius: 8px;
  overflow: hidden;
  background: #f0f0f0;
  flex-shrink: 0;
}

.actor-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.no-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #999;
}

.actor-info {
  flex: 1;
}

.actor-info h1 {
  font-size: 32px;
  margin-bottom: 15px;
}

.actor-info p {
  margin: 10px 0;
  color: #666;
}

.description {
  margin-top: 20px;
  padding: 15px;
  background: #f5f5f5;
  border-radius: 8px;
}

.description h3 {
  margin-bottom: 10px;
}

.actor-videos h2 {
  margin-bottom: 20px;
}

.video-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 20px;
}
</style>
