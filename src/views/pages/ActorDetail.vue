<template>
  <div class="detail-page" v-if="actor">
    <div class="detail-header">
      <div class="header-row">
        <h1>{{ actor.name }}</h1>
        <span v-if="actor.country" class="country-tag">{{ actor.country }}</span>
        <span v-if="actor.likeCount > 0" class="like-tag">♥ {{ actor.likeCount }}</span>
      </div>
      <p v-if="actor.alias" class="alias-row">别名：{{ actor.alias }}</p>
      <p v-if="actor.bio" class="bio-row">{{ actor.bio }}</p>
    </div>

    <!-- 海报墙 -->
    <div class="poster-wall" v-if="posters.length > 0">
      <div class="poster-grid" ref="posterGridRef">
        <div
          v-for="(p, i) in posters"
          :key="p"
          class="poster-item"
          :style="posterStyles[i]"
          @click="openLightbox(i)"
        >
          <img :src="`/api/actor/${actorId}/poster/${p}`" :alt="p" />
        </div>
      </div>
    </div>

    <!-- 灯箱 -->
    <div class="lightbox-overlay" v-if="lightboxIndex !== null" @click="closeLightbox">
      <img
        :src="`/api/actor/${actorId}/poster/${posters[lightboxIndex]}`"
        class="lightbox-image"
        @click.stop
      />
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
import { ref, onMounted, watch, computed } from 'vue'
import { useRoute } from 'vue-router'
import { actorApi } from '@/scripts/api'
import VideoCard from '@/views/components/VideoCard.vue'

const route = useRoute()
const actor = ref(null)
const videos = ref([])
const posters = ref([])
const posterStyles = ref([])
const lightboxIndex = ref(null)
const posterGridRef = ref(null)

const actorId = computed(() => route.params.id)

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

const generatePosterLayout = (count) => {
  const baseW = 150       // 基准宽度
  const baseH = 210       // 基准高度
  const pad = 20          // 容器内边距
  const overlapX = 40     // 水平重叠量（数值越小重叠越多）
  const overlapY = 30     // 垂直重叠量

  // 估算可用宽度
  const docW = window.innerWidth
  const availW = Math.min(docW - 80, 1200) - pad * 2
  const cellW = baseW - overlapX

  // 计算列数
  const cols = Math.max(2, Math.min(Math.floor(availW / cellW), count, 10))
  // 平均分配列间距，填满整个可用宽度
  const spacing = cols <= 1 ? availW - baseW : (availW - baseW) / (cols - 1)
  // 内容宽度
  const totalW = (cols - 1) * spacing + baseW
  const offsetX = pad + (availW - totalW) / 2

  const styles = []
  for (let i = 0; i < count; i++) {
    const col = i % cols
    const row = Math.floor(i / cols)
    const w = baseW + Math.random() * 20  // 150~170
    const x = offsetX + col * spacing + (spacing - w) / 2 + Math.random() * 12 - 6
    const y = pad + row * (baseH - overlapY) + Math.random() * 12 - 6
    styles.push({
      left: `${Math.max(0, x)}px`,
      top: `${Math.max(0, y)}px`,
      width: `${w}px`,
      transform: `rotate(${Math.random() * 6 - 3}deg)`,
      zIndex: i
    })
  }
  return styles
}

const loadPosters = async () => {
  try {
    const res = await fetch(`/api/actor/${route.params.id}/posters`).then(r => r.json())
    if (res.success && res.data && res.data.length > 0) {
      posters.value = res.data
      posterStyles.value = generatePosterLayout(res.data.length)
    }
  } catch (error) {
    console.error('加载海报失败:', error)
  }
}

const openLightbox = (index) => {
  lightboxIndex.value = index
}

const closeLightbox = () => {
  lightboxIndex.value = null
}

const loadAll = async () => {
  await Promise.all([loadActor(), loadVideos(), loadPosters()])
}

onMounted(() => {
  loadAll()
})

// 监听路由参数变化
watch(
  () => route.params.id,
  (newId) => {
    if (newId) {
      lightboxIndex.value = null
      loadAll()
    }
  }
)
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

.bio-row {
  color: #444;
  font-size: 15px;
  line-height: 1.6;
}

.poster-wall {
  flex-shrink: 0;
}

.poster-grid {
  position: relative;
  width: 100%;
  height: 50vh;
  overflow: hidden;
  padding: 20px;
  background: #fafafa;
  border-radius: 8px;
}

.poster-item {
  position: absolute;
  cursor: pointer;
  border-radius: 6px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
  transition: transform 0.2s ease, box-shadow 0.2s ease, z-index 0s;
  background: #fff;
}

.poster-item:hover {
  transform: scale(1.12) !important;
  box-shadow: 0 6px 20px rgba(0,0,0,0.3);
  z-index: 9999 !important;
}

.poster-item img {
  display: block;
  width: 100%;
  height: auto;
}

/* 灯箱 */
.lightbox-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.85);
  z-index: 9999;
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;
}

.lightbox-image {
  max-width: 90vw;
  max-height: 90vh;
  object-fit: contain;
  border-radius: 4px;
  box-shadow: 0 8px 40px rgba(0,0,0,0.5);
  cursor: default;
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
