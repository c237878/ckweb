<template>
  <div ref="wallRef" class="poster-wall" :style="{ height, minHeight }">
    <div class="poster-plane">
      <button
        v-for="(item, index) in shown"
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
      :aria-label="`海报预览 ${lightboxIndex + 1} / ${shown.length}`"
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
 *
 * 要的效果是"一面贴满照片的墙"：乍一看歪歪扭扭，细看每张之间间距又均匀。
 * 做法是抖动网格——先把画布等分成格子（每行的张数尽量平均，不留短尾行），
 * 每张在自己的格子里做小幅位移 + 小幅倾角，所以既不散乱也不会挤成一坨。
 *
 * 画布不滚动：格子尺寸由画布反推，张数超出容量就随机取一批展示（换 seed 即换一批）。
 * 随机量全部由「文件名哈希 + seed」派生而不是 Math.random()，
 * 因此 resize、翻页回来都不会跳位，只有换 seed 才换人。
 */
const props = defineProps({
  /** [{ key, src, alt }]：key 必须是稳定标识（文件名），布局种子与随机取批都靠它 */
  items: { type: Array, default: () => [] },
  height: { type: String, default: '50vh' },
  minHeight: { type: String, default: '420px' },
  /** 期望的海报宽度；实际会按画布容量在 0.72×–1.5× 之间伸缩 */
  baseWidth: { type: Number, default: 150 },
  /** 换一批：父组件自增即可，同一批内部顺序稳定 */
  seed: { type: Number, default: 0 },
  /**
   * 照片墙模式：尺寸与长宽比更多元、铺得更满、允许适度压叠，像真实贴出来的墙。
   * 默认关（演员详情那种整齐的网格观感不变）。
   */
  scatter: { type: Boolean, default: false }
})

const emit = defineEmits(['shown'])

const ASPECT = 1.4        // 海报竖比（高 / 宽）
const GAP = 18            // 期望间隙
const MAX_ROTATION = 5    // 最大倾角（deg）
const MAX_COLS = 10
const MIN_RATIO = 0.72    // 相对 baseWidth 的最小/最大缩放
const MAX_RATIO = 1.5

// 两种模式的松散程度。scatter 允许压叠的前提：位移不超过格心的 0.34、
// 单边不超过 1.3 倍格宽，所以每张总有大半面积露在最外侧，点得到
const LAYOUT = {
  grid: { fill: 0.86, jitter: 0.26, size: [0.92, 1.08], aspectJitter: 0 },
  scatter: { fill: 1, jitter: 0.34, size: [0.74, 1.3], aspectJitter: 0.16 }
}

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

const seedOf = (item, index) => hashKey(String(item.key ?? item.src ?? index))

const clamp = (n, lo, hi) => Math.min(Math.max(n, lo), hi)

/** 画布装得下几张：按可接受的最小海报宽度算 */
const capacity = computed(() => {
  const { width, height } = box.value
  const minW = props.baseWidth * MIN_RATIO
  const minH = minW * ASPECT
  if (width <= 0 || height <= 0) return Infinity
  const cols = clamp(Math.floor((width + GAP) / (minW + GAP)), 2, MAX_COLS)
  const rows = Math.max(1, Math.floor((height + GAP) / (minH + GAP)))
  return cols * rows
})

/**
 * 一个由 seed 决定的固定顺序，取前 N 张展示。
 * 画布变大变小时只是从同一个顺序里多取/少取，不会整墙重排。
 */
const ordered = computed(() => {
  const slot = 8 + (props.seed % 997)
  return props.items
    .map((item, i) => ({ item, i }))
    .sort((a, b) => unit(seedOf(a.item, a.i), slot) - unit(seedOf(b.item, b.i), slot))
    .map((e) => e.item)
})

const shown = computed(() => ordered.value.slice(0, Math.min(ordered.value.length, capacity.value)))

watch(
  () => [shown.value.length, props.items.length],
  () => emit('shown', { shown: shown.value.length, total: props.items.length }),
  { immediate: true }
)

const layout = computed(() => {
  const count = shown.value.length
  const { width: boxW, height: boxH } = box.value
  if (!count || boxW <= 0 || boxH <= 0) return []

  // 列数：先按"面积均分"求一个理想宽度，再回推列数，最后夹到合理区间
  const ideal = Math.sqrt((boxW * boxH) / (count * ASPECT))
  let cols = clamp(Math.round(boxW / clamp(ideal, props.baseWidth * MIN_RATIO, props.baseWidth * MAX_RATIO)), 1, MAX_COLS)
  cols = Math.min(cols, count)

  const rows = Math.ceil(count / cols)
  // 每行张数尽量平均（20 张 3 行 → 7/7/6），否则尾行稀稀拉拉，整墙看着偏
  const perRow = new Array(rows)
  const base = Math.floor(count / rows)
  const extra = count % rows
  for (let r = 0; r < rows; r++) perRow[r] = base + (r < extra ? 1 : 0)

  const mode = props.scatter ? LAYOUT.scatter : LAYOUT.grid
  const cellH = boxH / rows
  const w = clamp(Math.min(boxW / cols, cellH / ASPECT) * mode.fill, 60, props.baseWidth * MAX_RATIO)

  const out = new Array(count)
  let cursor = 0

  for (let r = 0; r < rows; r++) {
    const n = perRow[r]
    const cellW = boxW / n
    for (let c = 0; c < n; c++) {
      const i = cursor++
      const item = shown.value[i]
      const seed = seedOf(item, i)

      // 尺寸与长宽比各自抖一档，才有"不同规格的相片混着贴"的感觉
      const [lo, hi] = mode.size
      const size = w * (lo + unit(seed, 0) * (hi - lo))
      const aspect = ASPECT * (1 + (unit(seed, 4) - 0.5) * 2 * mode.aspectJitter)
      const pw = Math.round(size)
      const ph = Math.round(size * aspect)

      const cx = (c + 0.5) * cellW + (unit(seed, 1) - 0.5) * cellW * mode.jitter
      const cy = (r + 0.5) * cellH + (unit(seed, 2) - 0.5) * cellH * mode.jitter

      out[i] = {
        left: `${Math.round(clamp(cx - pw / 2, 0, Math.max(0, boxW - pw)))}px`,
        top: `${Math.round(clamp(cy - ph / 2, 0, Math.max(0, boxH - ph)))}px`,
        width: `${pw}px`,
        height: `${ph}px`,
        // 倾角与叠放次序都交给 CSS 变量，悬停在样式表里覆盖 transform
        '--rot': `${((unit(seed, 3) - 0.5) * MAX_ROTATION * 2).toFixed(2)}deg`,
        '--z': String(1 + Math.floor(unit(seed, 5) * 12))
      }
    }
  }

  return out
})

// 第一次量到尺寸前不露面，避免海报在没有坐标的瞬间糊在左上角
const ready = computed(() => layout.value.length > 0)
const styles = computed(() => layout.value)
const current = computed(() =>
  lightboxIndex.value === null ? null : shown.value[lightboxIndex.value] ?? null
)

const openLightbox = (index) => {
  if (!shown.value[index]) return
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

// 换一批 / 换演员后当前索引可能越界
watch(shown, (list) => {
  if (lightboxIndex.value !== null && !list[lightboxIndex.value]) closeLightbox()
})

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
  /* 画布不滚动：装不下就少贴几张（见 script 里的 capacity） */
  overflow: hidden;
  padding: var(--s5);
  background: var(--bg-elev);
  border: 1px solid var(--border);
  border-radius: var(--r2);
}

.poster-plane {
  position: absolute;
  inset: var(--s5);
}

.poster-item {
  position: absolute;
  padding: 0;
  overflow: hidden;
  background: var(--bg-elev-2);
  border: 1px solid var(--border);
  border-radius: var(--r1);
  box-shadow: var(--shadow-2);
  /* 叠放次序由哈希派生，才有"随手贴上去"的前后压叠感 */
  z-index: var(--z, 1);
  transform: rotate(var(--rot, 0deg));
  transition: transform var(--dur) var(--ease), box-shadow var(--dur) var(--ease);
  cursor: zoom-in;
}

/* 放大并摆正，同时抬到所有海报之上 */
.poster-item:hover,
.poster-item:focus-visible {
  z-index: 30;
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
