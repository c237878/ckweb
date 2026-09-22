<template>
  <div ref="wallRef" class="poster-wall" :style="{ height, minHeight }">
    <div class="poster-plane" :style="planeStyle">
      <button
        v-for="(item, index) in items"
        v-show="ready"
        :key="item.key || item.src || index"
        type="button"
        class="poster-item"
        :style="styles[index]"
        :aria-label="`放大查看海报：${item.alt || item.key || '未命名'}`"
        @click="openLightbox(index)"
      >
        <img :src="item.src" :alt="item.alt || '海报'" loading="lazy" decoding="async" />
      </button>
    </div>
  </div>

  <!-- 灯箱：Esc 关闭、焦点归还触发元素，层级用 --z-lightbox -->
  <div v-if="current" class="overlay lightbox" @click.self="closeLightbox">
    <figure
      ref="lightboxRef"
      class="lightbox__box"
      tabindex="-1"
      role="dialog"
      aria-modal="true"
      :aria-label="`海报预览 ${lightboxIndex + 1} / ${items.length}`"
    >
      <img class="lightbox__img" :src="current.src" :alt="current.alt || '海报'" />
      <figcaption v-if="$slots.caption || current.alt" class="lightbox__cap">
        <slot name="caption" :item="current" :index="lightboxIndex">{{ current.alt }}</slot>
      </figcaption>
      <button type="button" class="lightbox__close" aria-label="关闭预览" @click="closeLightbox">&times;</button>
    </figure>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

/**
 * 散贴海报墙：演员海报与「精彩瞬间」共用。
 * 原先两个页面各写了一份同样的 CONFIG + 抖动布局 + 悬停 + 灯箱，
 * 且布局用 Math.random() 取值、每次 resize 重算，海报会整体跳位。
 * 这里把随机量改成「文件名哈希派生」的稳定值：位置随容器缩放，但同一张海报
 * 的抖动比例、尺寸、倾角在 resize / 刷新后保持不变。
 */
const props = defineProps({
  /** [{ key, src, alt }]：key 必须是稳定标识（文件名），布局种子取它 */
  items: { type: Array, default: () => [] },
  height: { type: String, default: '50vh' },
  minHeight: { type: String, default: '420px' },
  baseWidth: { type: Number, default: 150 }
})

const ASPECT = 1.4       // 海报竖比
const JITTER = 0.35      // 相对格心的抖动幅度
const GAP = 18           // 期望间隙
const MAX_ROTATION = 5   // 最大倾角（deg）
const MAX_COLS = 8       // 宽屏上别拉成一整行

const wallRef = ref(null)
const lightboxRef = ref(null)
const box = ref({ width: 0, height: 0 })
const lightboxIndex = ref(null)
let lastFocused = null

// FNV-1a：把文件名压成 32 位种子
const hashKey = (text) => {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

// splitmix32：由 (种子, 槽位) 派生 [0,1) 的稳定散列值，替代 Math.random()
const unit = (seed, slot) => {
  let x = (seed ^ Math.imul(slot + 1, 0x9e3779b9)) >>> 0
  x = Math.imul(x ^ (x >>> 16), 0x21f0aaad) >>> 0
  x = Math.imul(x ^ (x >>> 15), 0x735a2d97) >>> 0
  return ((x ^ (x >>> 15)) >>> 0) / 0x100000000
}

const seedOf = (item, index) =>
  hashKey(String(item.key ?? item.src ?? index))

const layout = computed(() => {
  const count = props.items.length
  const { width: boxW, height: boxH } = box.value
  if (!count || boxW <= 0 || boxH <= 0) return { planeHeight: 0, styles: [] }

  let cols = Math.floor(boxW / (props.baseWidth + GAP))
  cols = Math.max(2, Math.min(cols, MAX_COLS))
  const rows = Math.ceil(count / cols)
  // 海报多了就按行高把画布拉长（外层滚动），而不是叠成一坨
  const planeHeight = Math.max(boxH, Math.round(rows * (props.baseWidth * ASPECT + GAP)))

  const stepX = boxW / cols
  const stepY = planeHeight / rows
  const styles = new Array(count)

  props.items.forEach((item, i) => {
    const seed = seedOf(item, i)
    const scale = 0.92 + unit(seed, 0) * 0.16
    const w = Math.round(props.baseWidth * scale)
    const h = Math.round(w * ASPECT)

    const col = i % cols
    const row = Math.floor(i / cols)
    const jitterX = (unit(seed, 1) - 0.5) * stepX * JITTER
    const jitterY = (unit(seed, 2) - 0.5) * stepY * JITTER
    const x = Math.min(Math.max(col * stepX + jitterX, 0), Math.max(0, boxW - w))
    const y = Math.min(Math.max(row * stepY + jitterY, 0), Math.max(0, planeHeight - h))
    const rotation = (unit(seed, 3) - 0.5) * MAX_ROTATION * 2

    styles[i] = {
      left: `${Math.round(x)}px`,
      top: `${Math.round(y)}px`,
      width: `${w}px`,
      height: `${h}px`,
      // 倾角交给 CSS 变量，悬停时在样式表里覆盖 transform，省掉 JS 悬停态
      '--rot': `${rotation.toFixed(2)}deg`
    }
  })

  return { planeHeight, styles }
})

const planeStyle = computed(() =>
  layout.value.planeHeight ? { height: `${layout.value.planeHeight}px` } : {}
)
// 第一次量到尺寸前不露面，避免海报在没有坐标的瞬间糊在左上角
const ready = computed(() => layout.value.planeHeight > 0)
const styles = computed(() => layout.value.styles)
const current = computed(() =>
  lightboxIndex.value === null ? null : props.items[lightboxIndex.value] ?? null
)

const openLightbox = (index) => {
  if (!props.items[index]) return
  lastFocused = document.activeElement
  lightboxIndex.value = index
  nextTick(() => lightboxRef.value?.focus({ preventScroll: true }))
}

const closeLightbox = () => {
  if (lightboxIndex.value === null) return
  lightboxIndex.value = null
  lastFocused?.focus?.({ preventScroll: true })
  lastFocused = null
}

// 换演员 / 切筛选后当前索引可能越界
watch(
  () => props.items,
  () => {
    if (lightboxIndex.value !== null && !props.items[lightboxIndex.value]) closeLightbox()
  }
)

const onKeydown = (event) => {
  if (event.key === 'Escape') closeLightbox()
}

let observer = null

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  // 走 window 引用，避开项目 eslint 里未声明的浏览器全局
  if (wallRef.value && window.ResizeObserver) {
    // observe 时立刻回调一次，首帧即有坐标；
    // 尺寸变化只重算几何，随机量已按 key 固化，海报不会再“跳位”，无需防抖
    observer = new window.ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      box.value = { width, height }
    })
    observer.observe(wallRef.value)
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  observer?.disconnect()
  observer = null
})
</script>

<style scoped>
.poster-wall {
  position: relative;
  overflow: auto;
  padding: var(--s5);
  background: var(--bg-elev);
  border: 1px solid var(--border);
  border-radius: var(--r2);
}

.poster-plane {
  position: relative;
  height: 100%;
}

.poster-item {
  position: absolute;
  padding: 0;
  overflow: hidden;
  background: var(--bg-elev-2);
  border: 1px solid var(--border);
  border-radius: var(--r1);
  box-shadow: var(--shadow-2);
  transform: rotate(var(--rot, 0deg));
  transition: transform var(--dur) var(--ease), box-shadow var(--dur) var(--ease);
  cursor: zoom-in;
}

/* 放大并摆正，同时抬到相邻海报之上 */
.poster-item:hover,
.poster-item:focus-visible {
  z-index: 2;
  box-shadow: var(--shadow-3);
  transform: scale(1.12) rotate(0deg);
}

/* 作用域里的 box-shadow 会盖掉全局焦点环，键盘聚焦时补回来 */
.poster-item:focus-visible {
  box-shadow: var(--ring), var(--shadow-3);
}

.poster-item img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  pointer-events: none;
}

.overlay.lightbox {
  z-index: var(--z-lightbox);
  background: var(--overlay);
  backdrop-filter: blur(6px);
  cursor: zoom-out;
}

.lightbox__box {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--s2);
  max-width: 90vw;
  outline: none;
}

.lightbox__img {
  max-width: 100%;
  max-height: 82vh;
  object-fit: contain;
  border-radius: var(--r1);
  background: var(--bg-elev-2);
  box-shadow: var(--shadow-3);
  cursor: default;
}

/* 深色遮罩上的文字用 #fff，不套正文令牌 */
.lightbox__cap {
  color: #fff;
  font-size: var(--f-sm);
  text-align: center;
  word-break: break-all;
}

.lightbox__close {
  position: absolute;
  top: calc(-1 * var(--s6));
  right: 0;
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: var(--rp);
  background: var(--overlay);
  color: #fff;
  font-size: var(--f-xl);
  line-height: 1;
  transition: background var(--dur) var(--ease), color var(--dur) var(--ease);
}

.lightbox__close:hover {
  background: var(--bg-elev);
  color: var(--text);
}
</style>
