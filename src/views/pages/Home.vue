<template>
  <div class="home">
    <!-- 今日推荐 -->
    <section class="section">
      <h2 class="section-title">今日推荐</h2>
      <div class="video-grid">
        <VideoCard v-for="video in recommendVideos" :key="video.id" :video="video" :show-actions="false" />
      </div>
    </section>

    <!-- 最新上映 -->
    <section class="section">
      <h2 class="section-title">最新上映</h2>
      <div class="video-grid">
        <VideoCard v-for="video in latestVideos" :key="video.id" :video="video" :show-actions="false" />
      </div>
    </section>

    <!-- 最受喜爱 -->
    <section class="section">
      <h2 class="section-title">最受喜爱</h2>
      <div class="video-grid">
        <VideoCard v-for="video in mostLikedVideos" :key="video.id" :video="video" :show-actions="false" />
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { videoApi } from '@/scripts/api'
import VideoCard from '@/views/components/VideoCard.vue'

const recommendVideos = ref([])
const latestVideos = ref([])
const mostLikedVideos = ref([])

onMounted(async () => {
  try {
    // 加载首页数据
    const [recommendRes, latestRes, mostLikedRes] = await Promise.all([
      videoApi.getRecommend(8),
      videoApi.getLatest(8),
      videoApi.getMostLiked(8)
    ])

    if (recommendRes.success) recommendVideos.value = recommendRes.data
    if (latestRes.success) latestVideos.value = latestRes.data
    if (mostLikedRes.success) mostLikedVideos.value = mostLikedRes.data
  } catch (error) {
    console.error('加载首页数据失败:', error)
  }
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
</style>
