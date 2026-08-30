<template>
  <div class="highlights-page">
    <div 
      class="hl-poster-wall" 
      v-if="posters.length > 0" 
      ref="wallRef"
    >
      <div
        v-for="(p, i) in posters"
        :key="p.id || p"
        class="hl-poster-item"
        :style="getPosterStyle(i)"
        @click="openLightbox(i)"
        @mouseenter="handleHover(i, true)"
        @mouseleave="handleHover(i, false)"
      >
        <img 
          :src="p.url || `/api/highlights/poster/${p}`" 
          :alt="p.title || '海报'" 
          loading="lazy"
        />
      </div>
    </div>
    
    <div class="hl-empty" v-else>
      <div class="empty-icon">📷</div>
      <p>暂无精彩瞬间</p>
      <p class="hl-hint">请先在设置中配置海报墙目录</p>
    </div>

    <!-- 灯箱 -->
    <transition name="fade">
      <div 
        class="hl-lightbox" 
        v-if="lightboxIndex !== null" 
        @click="closeLightbox"
      >
        <div class="lightbox-content" @click.stop>
          <img
            :src="getPosterSrc(lightboxIndex)"
            class="hl-lightbox-img"
          />
          <button class="close-btn" @click="closeLightbox">&times;</button>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue'

const posters = ref([])
const wallRef = ref(null)
const lightboxIndex = ref(null)
const posterStyles = ref({})
const hoveredIndex = ref(-1)

const CONFIG = {
  baseWidth: 160,
  aspectRatio: 1.4,
  jitterStrength: 0.4,
  minGap: 15,
  maxRotation: 6,
  padding: 20
}

const loadPosters = async () => {
  try {
    const res = await fetch('/api/highlights/posters').then(r => r.json())
    if (res.success && res.data) {
      posters.value = res.data.map((item, idx) => ({
        id: idx,
        url: item.url || `/api/highlights/poster/${item}`,
        title: `Poster ${idx + 1}`
      }))
      await nextTick()
      calculateLayout()
    }
  } catch (error) {
    console.error('加载失败:', error)
    posters.value = Array.from({ length: 20 }, (_, i) => ({
      id: i,
      url: `https://picsum.photos/300/420?random=${i}`,
      title: `Demo Poster ${i}`
    }))
    await nextTick()
    calculateLayout()
  }
}

const calculateLayout = () => {
  if (!wallRef.value || posters.value.length === 0) return

  const containerW = wallRef.value.clientWidth
  const containerH = wallRef.value.clientHeight
  
  const effectiveW = containerW - CONFIG.padding * 2
  const effectiveH = containerH - CONFIG.padding * 2
  
  const avgItemW = CONFIG.baseWidth + CONFIG.minGap
  const avgItemH = (CONFIG.baseWidth * CONFIG.aspectRatio) + CONFIG.minGap
  
  let cols = Math.floor(effectiveW / avgItemW)
  cols = Math.max(2, cols)
  
  const rows = Math.ceil(posters.value.length / cols)
  
  const stepX = effectiveW / cols
  const stepY = effectiveH / rows
  
  const newStyles = {}
  
  posters.value.forEach((_, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    
    const baseX = col * stepX + CONFIG.padding
    const baseY = row * stepY + CONFIG.padding
    
    const jitterX = (Math.random() - 0.5) * stepX * CONFIG.jitterStrength
    const jitterY = (Math.random() - 0.5) * stepY * CONFIG.jitterStrength
    
    let finalX = baseX + jitterX
    let finalY = baseY + jitterY
    
    finalX = Math.max(CONFIG.padding, Math.min(finalX, containerW - CONFIG.baseWidth - CONFIG.padding))
    finalY = Math.max(CONFIG.padding, Math.min(finalY, containerH - (CONFIG.baseWidth * CONFIG.aspectRatio) - CONFIG.padding))
    
    const scaleVar = 0.9 + Math.random() * 0.2
    const w = CONFIG.baseWidth * scaleVar
    const h = w * CONFIG.aspectRatio
    
    const rot = (Math.random() - 0.5) * CONFIG.maxRotation * 2
    
    newStyles[i] = {
      left: `${finalX}px`,
      top: `${finalY}px`,
      width: `${w}px`,
      height: `${h}px`,
      transform: `rotate(${rot}deg)`,
      zIndex: 1,
      transition: 'all 0.4s cubic-bezier(0.25, 0.8, 0.25, 1)'
    }
  })
  
  posterStyles.value = newStyles
}

const getPosterStyle = (index) => {
  const style = posterStyles.value[index] || {}
  const isHovered = hoveredIndex.value === index
  
  // 修改点：移除 zIndex 提升，仅保留缩放、去旋转和阴影加深
  if (isHovered) {
    return {
      ...style,
      // zIndex 保持不变，不强制设为 100
      transform: 'scale(1.15) rotate(0deg)',
      boxShadow: '0 15px 35px rgba(0,0,0,0.3)'
    }
  }
  
  return style
}

const handleHover = (index, isEnter) => {
  hoveredIndex.value = isEnter ? index : -1
}

const getPosterSrc = (index) => {
  if (!posters.value[index]) return ''
  return posters.value[index].url
}

const openLightbox = (index) => {
  lightboxIndex.value = index
}

const closeLightbox = () => {
  lightboxIndex.value = null
}

let resizeTimer = null
const onResize = () => {
  clearTimeout(resizeTimer)
  resizeTimer = setTimeout(() => {
    calculateLayout()
  }, 200)
}

onMounted(() => {
  loadPosters()
  window.addEventListener('resize', onResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', onResize)
  clearTimeout(resizeTimer)
})
</script>

<style scoped>
.highlights-page {
  position: relative;
  width: 100%;
  height: 100vh;
  background-color: #f8f9fa;
  overflow: hidden;
}

.hl-poster-wall {
  position: relative;
  width: 100%;
  height: 100%;
  padding: 20px;
  box-sizing: border-box;
}

.hl-poster-item {
  position: absolute;
  border-radius: 8px;
  overflow: hidden;
  background: #fff;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  cursor: pointer;
  will-change: transform, left, top;
}

.hl-poster-item img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  pointer-events: none;
}

.hl-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #9ca3af;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.hl-hint {
  font-size: 14px;
  margin-top: 8px;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.hl-lightbox {
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
}

.lightbox-content {
  position: relative;
  max-width: 90vw;
  max-height: 90vh;
}

.hl-lightbox-img {
  max-width: 100%;
  max-height: 90vh;
  border-radius: 4px;
  box-shadow: 0 20px 50px rgba(0,0,0,0.5);
  object-fit: contain;
}

.close-btn {
  position: absolute;
  top: -40px;
  right: 0;
  background: none;
  border: none;
  color: white;
  font-size: 32px;
  cursor: pointer;
  opacity: 0.8;
  transition: opacity 0.2s;
}

.close-btn:hover {
  opacity: 1;
}
</style>