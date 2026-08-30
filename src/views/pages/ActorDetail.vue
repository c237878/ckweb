<template>
  <div class="detail-page" v-if="actor">
    <div class="detail-header">
      <div class="header-row">
        <h1>{{ actor.name }}</h1>
        <span v-if="actor.country" class="country-tag">{{ actor.country }}</span>
        <span v-if="actor.likeCount > 0" class="like-tag">♥ {{ actor.likeCount }}</span>
        <button class="edit-btn" @click="openEditDialog">编辑</button>
      </div>
      <p v-if="actor.alias" class="alias-row">别名：{{ actor.alias }}</p>
      <p v-if="actor.bio" class="bio-row">{{ decodeBio(actor.bio) }}</p>
    </div>

    <!-- 海报墙（优化后） -->
    <div class="poster-wall" v-if="posters.length > 0">
      <div class="poster-grid" ref="posterGridRef">
        <div
          v-for="(p, i) in posters"
          :key="p"
          class="poster-item"
          :style="getPosterStyle(i)"
          @click="openLightbox(i)"
          @mouseenter="handleHover(i, true)"
          @mouseleave="handleHover(i, false)"
        >
          <img 
            :src="`/api/actor/${actorId}/poster/${encodeURIComponent(p)}`" 
            :alt="p" 
            loading="lazy" 
          />
        </div>
      </div>
    </div>

    <!-- 灯箱 -->
    <div class="lightbox-overlay" v-if="lightboxIndex !== null" @click="closeLightbox">
      <img
        :src="`/api/actor/${actorId}/poster/${encodeURIComponent(posters[lightboxIndex])}`"
        class="lightbox-image"
        @click.stop
      />
    </div>

    <div class="detail-videos">
      <div class="videos-header">
        <h2>参演影片 ({{ displayVideos.length }})</h2>
        <select v-model="mediaAttrFilter" class="media-filter">
          <option value="">全部片源</option>
          <option value="0">未设置</option>
          <option value="1">劣质</option>
          <option value="2">无字幕</option>
          <option value="3">完美</option>
        </select>
      </div>
      <div class="video-grid">
        <VideoCard v-for="video in displayVideos" :key="video.id" :video="video" mode="display" />
        <div v-if="displayVideos.length === 0" class="empty-hint">暂无影片</div>
      </div>
    </div>

    <AddActorDialog
      :visible="showEditDialog"
      :editingActor="actor"
      @save="onEditSave"
      @cancel="showEditDialog = false"
      @delete="onDelete"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, watch, computed, nextTick, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { actorApi } from '@/scripts/api'
import VideoCard from '@/views/components/VideoCard.vue'
import AddActorDialog from '@/views/components/AddActorDialog.vue'

const route = useRoute()
const actor = ref(null)
const videos = ref([])
const mediaAttrFilter = ref('')
const displayVideos = computed(() => {
  if (!mediaAttrFilter.value) return videos.value
  const f = parseInt(mediaAttrFilter.value)
  return videos.value.filter(v => (v.mediaAttrFlags || 0) === f)
})
const posters = ref([])
const posterStyles = ref({})
const hoveredIndex = ref(-1)
const lightboxIndex = ref(null)
const posterGridRef = ref(null)

// 海报墙配置（与首页保持一致）
const POSTER_CONFIG = {
  baseWidth: 150,
  aspectRatio: 1.4,      // 宽高比 1:1.4
  jitterStrength: 0.35,  // 抖动强度
  minGap: 20,
  maxRotation: 5,
  padding: 20
}

// 解码简介中可能包含的 URL 编码文本
const decodeBio = (text) => {
  try {
    return decodeURIComponent(text)
  } catch {
    return text
  }
}

const actorId = computed(() => route.params.id)
const showEditDialog = ref(false)

const openEditDialog = () => {
  showEditDialog.value = true
}

const onEditSave = async (formData) => {
  try {
    await actorApi.update(actor.value.id, formData)
    showEditDialog.value = false
    await loadActor()
  } catch (error) {
    alert('保存失败：' + (error.message || error))
  }
}

const onDelete = async (id) => {
  if (!confirm('确定要删除该演员吗？')) return
  try {
    await actorApi.delete(id)
    showEditDialog.value = false
    // 删除后跳转回演员列表
    window.location.href = '/actor'
  } catch (error) {
    alert('删除失败：' + (error.message || error))
  }
}

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
    const res = await actorApi.getVideos(route.params.id, { page: 1, pageSize: 1000 })
    if (res.success) {
      videos.value = res.data || []
    }
  } catch (error) {
    console.error('加载演员影片失败:', error)
  }
}

// 新的网格抖动布局算法
const calculatePosterLayout = () => {
  if (!posterGridRef.value || posters.value.length === 0) return

  const containerW = posterGridRef.value.clientWidth
  const containerH = posterGridRef.value.clientHeight
  
  const effectiveW = containerW - POSTER_CONFIG.padding * 2
  const effectiveH = containerH - POSTER_CONFIG.padding * 2
  
  const avgItemW = POSTER_CONFIG.baseWidth + POSTER_CONFIG.minGap
  const avgItemH = (POSTER_CONFIG.baseWidth * POSTER_CONFIG.aspectRatio) + POSTER_CONFIG.minGap
  
  // 计算列数
  let cols = Math.floor(effectiveW / avgItemW)
  cols = Math.max(2, Math.min(cols, 8)) // 限制最大8列
  
  const rows = Math.ceil(posters.value.length / cols)
  
  const stepX = effectiveW / cols
  const stepY = effectiveH / rows
  
  const newStyles = {}
  
  posters.value.forEach((_, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    
    // 基础网格位置
    const baseX = col * stepX + POSTER_CONFIG.padding
    const baseY = row * stepY + POSTER_CONFIG.padding
    
    // 应用抖动
    const jitterX = (Math.random() - 0.5) * stepX * POSTER_CONFIG.jitterStrength
    const jitterY = (Math.random() - 0.5) * stepY * POSTER_CONFIG.jitterStrength
    
    let finalX = baseX + jitterX
    let finalY = baseY + jitterY
    
    // 边界检查
    finalX = Math.max(POSTER_CONFIG.padding, Math.min(finalX, containerW - POSTER_CONFIG.baseWidth - POSTER_CONFIG.padding))
    finalY = Math.max(POSTER_CONFIG.padding, Math.min(finalY, containerH - (POSTER_CONFIG.baseWidth * POSTER_CONFIG.aspectRatio) - POSTER_CONFIG.padding))
    
    // 随机大小微调 (±10%)
    const scaleVar = 0.9 + Math.random() * 0.2
    const w = POSTER_CONFIG.baseWidth * scaleVar
    const h = w * POSTER_CONFIG.aspectRatio
    
    // 随机旋转
    const rot = (Math.random() - 0.5) * POSTER_CONFIG.maxRotation * 2
    
    newStyles[i] = {
      left: `${finalX}px`,
      top: `${finalY}px`,
      width: `${w}px`,
      height: `${h}px`,
      transform: `rotate(${rot}deg)`,
      zIndex: 1,
      transition: 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)'
    }
  })
  
  posterStyles.value = newStyles
}

// 获取海报样式（包含悬停效果）
const getPosterStyle = (index) => {
  const style = posterStyles.value[index] || {}
  const isHovered = hoveredIndex.value === index
  
  // 悬停效果：仅放大和去旋转，不改变 z-index（保持自然堆叠）
  if (isHovered) {
    return {
      ...style,
      transform: 'scale(1.12) rotate(0deg)',
      boxShadow: '0 8px 25px rgba(0,0,0,0.25)'
    }
  }
  
  return style
}

const handleHover = (index, isEnter) => {
  hoveredIndex.value = isEnter ? index : -1
}

const loadPosters = async () => {
  try {
    const res = await fetch(`/api/actor/${route.params.id}/posters`).then(r => r.json())
    if (res.success && res.data && res.data.length > 0) {
      posters.value = res.data
      await nextTick()
      calculatePosterLayout()
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

// 窗口大小变化监听
let resizeTimer = null
const onResize = () => {
  clearTimeout(resizeTimer)
  resizeTimer = setTimeout(() => {
    if (posters.value.length > 0) calculatePosterLayout()
  }, 300)
}

onMounted(() => {
  loadAll()
  window.addEventListener('resize', onResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', onResize)
  clearTimeout(resizeTimer)
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
  gap: 24px;
  padding: 20px;
}

.detail-header {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 20px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
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
  color: #333;
}

.edit-btn {
  background: none;
  border: 1px solid #ccc;
  border-radius: 4px;
  padding: 6px 16px;
  font-size: 14px;
  color: #666;
  cursor: pointer;
  transition: all 0.2s;
}

.edit-btn:hover {
  border-color: #3498db;
  color: #3498db;
  background: #f5f9ff;
}

.country-tag {
  background: #f3e5f5;
  color: #7b1fa2;
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 500;
}

.like-tag {
  background: #fce4ec;
  color: #e74c3c;
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 500;
}

.alias-row {
  color: #666;
  font-size: 15px;
  margin: 0;
}

.bio-row {
  color: #444;
  font-size: 15px;
  line-height: 1.6;
  margin: 0;
}

/* 海报墙（优化后样式） */
.poster-wall {
  flex-shrink: 0;
}

.poster-grid {
  position: relative;
  width: 100%;
  height: 50vh;
  min-height: 400px;
  overflow: hidden;
  padding: 20px;
  background: #fafafa;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
}

.poster-item {
  position: absolute;
  cursor: pointer;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 3px 12px rgba(0,0,0,0.1);
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  background: #fff;
  will-change: transform, left, top;
}

.poster-item img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  pointer-events: none;
}

/* 移除了 z-index 强制提升，保持自然堆叠 */
.poster-item:hover {
  transform: scale(1.12) rotate(0deg) !important;
  box-shadow: 0 8px 25px rgba(0,0,0,0.25);
  /* z-index 保持不变 */
}

/* 灯箱 */
.lightbox-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(5px);
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

/* 影片区域 */
.detail-videos {
  background: #fff;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
}

.videos-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 12px;
}

.videos-header h2 {
  margin: 0;
  font-size: 20px;
  color: #333;
}

.media-filter {
  padding: 6px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  background: #fff;
  color: #333;
  cursor: pointer;
  min-width: 120px;
}

.media-filter:focus {
  outline: none;
  border-color: #3498db;
}

.video-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 20px;
}

.empty-hint {
  color: #999;
  font-size: 14px;
  padding: 40px 20px;
  text-align: center;
  grid-column: 1 / -1;
}
</style>
