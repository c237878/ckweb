<template>
  <div class="video-detail" v-if="video">
    <div class="video-player">
      <video v-if="video.videoUrl" :src="video.videoUrl" controls></video>
      <div v-else class="no-video">暂无视频</div>
    </div>
    <div class="video-info">
      <h1>{{ video.name }}</h1>
      <div class="meta">
        <p><strong>番号:</strong> {{ video.code || '无' }}</p>
        <p><strong>国家:</strong> {{ video.country || '未知' }}</p>
        <p><strong>画质:</strong> {{ video.quality || '未知' }}</p>
        <p><strong>大小:</strong> {{ formatSize(video.videoSize) }}</p>
      </div>

      <!-- 演员列表 -->
      <div class="actors-section" v-if="actors.length > 0">
        <h3>演员</h3>
        <div class="actors-list">
          <div 
            v-for="actor in actors" 
            :key="actor.id" 
            class="actor-item"
            @click="goToActor(actor.id)"
          >
            {{ actor.name }}
            <span v-if="actor.alias" class="alias">({{ actor.alias }})</span>
          </div>
        </div>
      </div>

      <div class="actions">
        <button class="like-btn" :class="{ liked: isLiked }" @click="toggleLike">
          {{ isLiked ? '取消点赞' : '点赞' }} ({{ likeCount }})
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { videoApi, likeApi } from '@/scripts/api'

const route = useRoute()
const router = useRouter()
const video = ref(null)
const actors = ref([])
const likeCount = ref(0)
const isLiked = ref(false)
const userToken = ref(localStorage.getItem('userToken') || generateToken())

onMounted(async () => {
  await loadVideo()
  await loadLikeInfo()
})

const loadVideo = async () => {
  try {
    const res = await videoApi.getDetail(route.params.id)
    if (res.success) {
      video.value = res.data
      actors.value = res.actors || []
    }
  } catch (error) {
    console.error('加载视频详情失败:', error)
  }
}

const loadLikeInfo = async () => {
  try {
    const [countRes, likedRes] = await Promise.all([
      likeApi.getCount(route.params.id),
      likeApi.checkLiked(route.params.id, userToken.value)
    ])
    if (countRes.success) likeCount.value = countRes.data
    if (likedRes.success) isLiked.value = likedRes.data
  } catch (error) {
    console.error('加载点赞信息失败:', error)
  }
}

const toggleLike = async () => {
  try {
    if (isLiked.value) {
      const res = await likeApi.unlike(route.params.id, userToken.value)
      if (res.success) {
        isLiked.value = false
        likeCount.value--
      }
    } else {
      const res = await likeApi.like(route.params.id, userToken.value)
      if (res.success) {
        isLiked.value = true
        likeCount.value++
        localStorage.setItem('userToken', userToken.value)
      }
    }
  } catch (error) {
    console.error('点赞操作失败:', error)
  }
}

const goToActor = (actorId) => {
  router.push(`/actor/${actorId}`)
}

const formatSize = (bytes) => {
  if (!bytes) return '未知'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0
  while (bytes >= 1024 && i < units.length - 1) {
    bytes /= 1024
    i++
  }
  return bytes.toFixed(2) + ' ' + units[i]
}

function generateToken() {
  return 'user_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36)
}
</script>

<style scoped>
.video-detail {
  padding: 20px 0;
}

.video-player {
  width: 100%;
  max-width: 800px;
  margin: 0 auto 30px;
  background: #000;
  border-radius: 8px;
  overflow: hidden;
}

.video-player video {
  width: 100%;
  display: block;
}

.no-video {
  height: 400px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #999;
  font-size: 18px;
}

.video-info {
  max-width: 800px;
  margin: 0 auto;
}

.video-info h1 {
  font-size: 28px;
  margin-bottom: 20px;
}

.meta {
  margin-bottom: 20px;
}

.meta p {
  margin: 8px 0;
  color: #666;
}

.actors-section {
  margin: 30px 0;
  padding: 20px;
  background: #f5f5f5;
  border-radius: 8px;
}

.actors-section h3 {
  margin-bottom: 15px;
  font-size: 18px;
}

.actors-list {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.actor-item {
  padding: 8px 16px;
  background: white;
  border-radius: 20px;
  cursor: pointer;
  transition: all 0.3s;
  font-size: 14px;
}

.actor-item:hover {
  background: #3498db;
  color: white;
}

.actor-item .alias {
  color: #999;
  font-size: 12px;
  margin-left: 5px;
}

.actor-item:hover .alias {
  color: #e0e0e0;
}

.actions {
  margin-top: 30px;
}

.like-btn {
  padding: 12px 30px;
  background: #e74c3c;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  cursor: pointer;
  transition: background 0.3s;
}

.like-btn:hover {
  background: #c0392b;
}

.like-btn.liked {
  background: #95a5a6;
}
</style>
