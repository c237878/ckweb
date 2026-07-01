<template>
  <div class="highlights-page">
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
  if (count === 0) { posterStyles.value = []; return }

  const docW = window.innerWidth
  const docH = window.innerHeight - 60
  const padding = 20
  const availW = docW - padding * 2
  const availH = docH - padding * 2

  const baseW = 140
  const baseH = baseW * 1.4
  const overlapX = 20
  const overlapY = 20

  const cellW = baseW - overlapX
  const cols = Math.min(Math.floor(availW / cellW), count)
  const rows = Math.ceil(count / cols)

  // 水平间距均匀分布撑满宽度
  const hStep = cols > 1 ? (availW - baseW) / (cols - 1) : 0
  const offsetX = cols > 1 ? (availW - (cols - 1) * hStep - baseW) / 2 : (availW - baseW) / 2

  // 垂直间距均匀分布撑满高度
  const vStep = rows > 1 ? (availH - baseH) / (rows - 1) : (availH - baseH) / 2

  const styles = []
  for (let i = 0; i < count; i++) {
    const col = i % cols
    const row = Math.floor(i / cols)
    const w = baseW + Math.random() * 20
    const x = offsetX + col * hStep + (Math.random() - 0.5) * 14
    const y = row * vStep + (Math.random() - 0.5) * 14
    styles.push({
      left: `${Math.max(0, x)}px`,
      top: `${Math.max(0, y)}px`,
      width: `${w}px`,
      transform: `rotate(${Math.random() * 8 - 4}deg)`,
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
  min-height: calc(100vh - 60px);
  width: 100%;
  overflow: hidden;
}

.hl-poster-wall {
  position: relative;
  width: 100%;
  height: calc(100vh - 60px);
  overflow: hidden;
  padding: 20px;
}

.hl-poster-item {
  position: absolute;
  cursor: pointer;
  border-radius: 6px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0,0,0,0.25);
  transition: transform 0.25s ease, box-shadow 0.25s ease;
  background: #fff;
}

.hl-poster-item:hover {
  transform: scale(1.15) !important;
  box-shadow: 0 8px 30px rgba(0,0,0,0.4);
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
