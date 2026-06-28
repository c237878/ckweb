<template>
  <div class="highlights-page">
    <div class="hl-header">
      <h1>精彩瞬间</h1>
    </div>
    <div class="hl-poster-wall" v-if="posters.length > 0" ref="wallRef">
      <div
        v-for="(p, i) in posters"
        :key="p"
        class="hl-poster-item"
        :style="posterStyles[i]"
        @click="openLightbox(i)"
      >
        <img :src="`/api/highlights/poster/${p}`" :alt="p" />
      </div>
    </div>
    <div class="hl-empty" v-else>
      <p>暂无精彩瞬间</p>
      <p class="hl-hint">请先在设置中配置海报墙目录，并将图片放入 <code>{posterDir}/default/</code> 文件夹</p>
    </div>

    <!-- 灯箱 -->
    <div class="hl-lightbox" v-if="lightboxIndex !== null" @click="closeLightbox">
      <img
        :src="`/api/highlights/poster/${posters[lightboxIndex]}`"
        class="hl-lightbox-img"
        @click.stop
      />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const posters = ref([])
const posterStyles = ref([])
const lightboxIndex = ref(null)
const wallRef = ref(null)

const loadPosters = async () => {
  try {
    const res = await fetch('/api/highlights/posters').then(r => r.json())
    if (res.success && res.data && res.data.length > 0) {
      posters.value = res.data
      generateLayout()
    }
  } catch (error) {
    console.error('加载精彩瞬间失败:', error)
  }
}

const generateLayout = () => {
  const count = posters.value.length
  const baseW = 150
  const baseH = 210
  const overlapX = 80
  const overlapY = 50

  const docW = window.innerWidth
  const availW = docW - 40
  const cellW = baseW - overlapX
  const cols = Math.max(2, Math.min(Math.floor(availW / cellW), count, 12))
  const spacing = cols <= 1 ? availW - baseW : (availW - baseW) / (cols - 1)
  const totalW = (cols - 1) * spacing + baseW
  const offsetX = (availW - totalW) / 2

  // 估算行数以决定是否完全撑满视口高度
  const rows = Math.ceil(count / cols)
  const totalH = rows * (baseH - overlapY) + 80 // 80 = padding top+bottom

  const styles = []
  for (let i = 0; i < count; i++) {
    const col = i % cols
    const row = Math.floor(i / cols)
    const w = baseW + Math.random() * 30
    const x = offsetX + col * spacing + (spacing - w) / 2 + Math.random() * 10 - 5
    const y = 20 + row * (baseH - overlapY) + Math.random() * 16 - 8
    styles.push({
      left: `${Math.max(0, x)}px`,
      top: `${Math.max(0, y)}px`,
      width: `${w}px`,
      transform: `rotate(${Math.random() * 6 - 3}deg)`,
      zIndex: i + 1
    })
  }
  posterStyles.value = styles
}

let resizeTimer = null
const onResize = () => {
  clearTimeout(resizeTimer)
  resizeTimer = setTimeout(() => {
    if (posters.value.length > 0) generateLayout()
  }, 300)
}

const openLightbox = (index) => {
  lightboxIndex.value = index
}

const closeLightbox = () => {
  lightboxIndex.value = null
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
  min-height: calc(100vh - 60px);
  overflow: hidden;
}

.hl-header {
  position: fixed;
  top: 70px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 100;
  background: rgba(0,0,0,0.5);
  backdrop-filter: blur(8px);
  padding: 8px 24px;
  border-radius: 20px;
  pointer-events: none;
}

.hl-header h1 {
  margin: 0;
  font-size: 18px;
  color: #fff;
  font-weight: normal;
}

.hl-poster-wall {
  position: relative;
  width: 100%;
  height: calc(100vh - 60px);
  overflow: hidden;
  padding: 20px;
  background: #1a1a2e;
}

.hl-poster-item {
  position: absolute;
  cursor: pointer;
  border-radius: 6px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0,0,0,0.3);
  transition: transform 0.25s ease, box-shadow 0.25s ease;
  background: #fff;
}

.hl-poster-item:hover {
  transform: scale(1.15) !important;
  box-shadow: 0 8px 30px rgba(0,0,0,0.5);
  z-index: 9999 !important;
}

.hl-poster-item img {
  display: block;
  width: 100%;
  height: auto;
}

.hl-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: calc(100vh - 60px);
  color: #999;
  font-size: 16px;
}

.hl-hint {
  margin-top: 12px;
  font-size: 13px;
  color: #777;
}

.hl-hint code {
  background: #f0f0f0;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 12px;
}

/* 灯箱 */
.hl-lightbox {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.9);
  z-index: 99999;
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;
}

.hl-lightbox-img {
  max-width: 92vw;
  max-height: 92vh;
  object-fit: contain;
  border-radius: 4px;
  box-shadow: 0 8px 40px rgba(0,0,0,0.5);
  cursor: default;
}
</style>
