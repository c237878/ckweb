<template>
  <div v-if="!count" class="album album--empty">
    <span class="album__empty-text">{{ emptyText }}</span>
    <button type="button" class="btn btn--sm" :disabled="syncing" @click="sync">
      {{ syncing ? '同步中…' : '同步照片' }}
    </button>
  </div>

  <div v-else class="album">
    <div
      class="album__frame"
      :style="aspectStyle"
      role="group"
      aria-roledescription="相册"
      :aria-label="`演员照片 ${index + 1} / ${count}，${name}`"
    >
      <!-- 放大与翻页都挂在同一个按钮上：整个相册只占一个 Tab 停靠点 -->
      <button
        type="button"
        class="album__zoom"
        :aria-label="`放大查看原图：${current.fileName}（左右方向键翻页）`"
        @click="openZoom"
        @keydown="onKeydown"
      >
        <img
          :key="current.fileName"
          class="album__img"
          :src="thumbUrl(current.fileName)"
          :alt="`${name} 照片 ${index + 1}`"
          decoding="async"
          @load="onThumbLoad"
        />
      </button>

      <button
        v-if="count > 1"
        type="button"
        class="album__nav album__nav--prev"
        aria-label="上一张"
        @click="step(-1)"
      >
        &lsaquo;
      </button>
      <button
        v-if="count > 1"
        type="button"
        class="album__nav album__nav--next"
        aria-label="下一张"
        @click="step(1)"
      >
        &rsaquo;
      </button>
    </div>

    <div class="album__foot">
      <span class="album__count">
        {{ index + 1 }} / {{ count }}
        <span v-if="current.primary" class="album__badge">头像</span>
      </span>
      <div class="album__actions">
        <button
          v-if="!current.primary"
          type="button"
          class="btn btn--sm btn--ghost"
          title="把这一张设为演员列表页上的脸"
          @click="emit('set-primary', current.fileName)"
        >
          设为头像
        </button>
        <button type="button" class="btn btn--sm btn--ghost" :disabled="syncing" @click="sync">
          {{ syncing ? '同步中…' : '重新同步' }}
        </button>
      </div>
    </div>
  </div>

  <!-- 放大看原图：缩略图只到 400px，要看细节得回源 -->
  <div v-if="zoomed" class="overlay album-lightbox" @click.self="closeZoom">
    <figure
      ref="zoomEl"
      class="album-lightbox__box"
      tabindex="-1"
      role="dialog"
      aria-modal="true"
      :aria-label="`原图预览 ${index + 1} / ${count}`"
      @keydown="onKeydown"
    >
      <img class="album-lightbox__img" :src="posterUrl(current.fileName)" :alt="`${name} ${current.fileName}`" />
      <figcaption class="album-lightbox__cap">{{ current.fileName }} · {{ mb(current.size) }}</figcaption>
      <button
        v-if="count > 1"
        type="button"
        class="album-lightbox__nav album-lightbox__nav--prev"
        aria-label="上一张"
        @click="step(-1)"
      >
        &lsaquo;
      </button>
      <button
        v-if="count > 1"
        type="button"
        class="album-lightbox__nav album-lightbox__nav--next"
        aria-label="下一张"
        @click="step(1)"
      >
        &rsaquo;
      </button>
      <button type="button" class="album-lightbox__close" aria-label="关闭预览" @click="closeZoom">&times;</button>
    </figure>
  </div>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue'

/**
 * 演员相册：详情页头部右侧那一格。
 *
 * 与「艳图」的 PosterWall 是两回事——那边是一墙小图供浏览，这边是一次看一张、
 * 左右翻页，因为演员图片动辄几十张、单张细节才有意义。
 * 图片清单来自 actor_images 表（由「同步照片」按钮触发扫描），这里不再隐式扫盘。
 */
const props = defineProps({
  actorId: { type: String, required: true },
  /** [{ fileName, primary, width, height, size }]，后端已把主图排在第一位 */
  images: { type: Array, default: () => [] },
  name: { type: String, default: '' },
  emptyText: { type: String, default: '还没有照片' },
  syncing: { type: Boolean, default: false }
})

const emit = defineEmits(['sync', 'set-primary'])

const key = ref('')
const zoomed = ref(false)
const zoomEl = ref(null)
let lastFocused = null

const count = computed(() => props.images.length)
// 当前看的是哪张按文件名记，不按序号：设为主图后后端会把那张挪到最前，
// 记序号的话翻页会跳到别的图片上
const current = computed(
  () => props.images.find((x) => x.fileName === key.value) || props.images[0] || {}
)
const index = computed(() => {
  const at = props.images.findIndex((x) => x.fileName === current.value.fileName)
  return at < 0 ? 0 : at
})

const thumbUrl = (fileName) => `/api/actor/${props.actorId}/thumb/m/${encodeURIComponent(fileName)}`
const posterUrl = (fileName) => `/api/actor/${props.actorId}/poster/${encodeURIComponent(fileName)}`

// 知道原图宽高就把画框比例调成它的，画框就不会在竖图两侧留白。
// 表里没尺寸（这张还没出过缩略图）时用刚加载到的自然尺寸顶上，
// 首次浏览也不会先按 2:3 摆好再跳一下
const liveAr = ref('')
const aspectStyle = computed(() => {
  const { width, height } = current.value
  if (width > 0 && height > 0) return { '--ar': (width / height).toFixed(4) }
  return liveAr.value ? { '--ar': liveAr.value } : {}
})

const onThumbLoad = (event) => {
  const { naturalWidth: w, naturalHeight: h } = event.target
  liveAr.value = w > 0 && h > 0 ? (w / h).toFixed(4) : ''
}

const mb = (bytes) => (bytes ? `${(bytes / 1048576).toFixed(1)} MB` : '')

const step = (delta) => {
  const n = count.value
  if (n < 2) return
  key.value = props.images[(index.value + delta + n) % n].fileName
  // 新的一张还没解码出来之前，别把上一张的比例当成它的
  liveAr.value = ''
}

const sync = () => emit('sync')

const openZoom = () => {
  if (!count.value) return
  lastFocused = document.activeElement
  zoomed.value = true
  nextTick(() => zoomEl.value?.focus({ preventScroll: true }))
}

const closeZoom = () => {
  if (!zoomed.value) return
  zoomed.value = false
  lastFocused?.focus?.({ preventScroll: true })
  lastFocused = null
}

function onKeydown(event) {
  if (event.key === 'ArrowLeft') {
    event.preventDefault()
    step(-1)
  } else if (event.key === 'ArrowRight') {
    event.preventDefault()
    step(1)
  } else if (event.key === 'Escape') {
    closeZoom()
  }
}

// 换演员时别带着上一个的那张图
watch(() => props.actorId, () => {
  key.value = ''
  liveAr.value = ''
  closeZoom()
})
</script>

<style scoped>
.album {
  display: flex;
  flex-direction: column;
  gap: var(--s2);
  min-width: 0;
}

.album--empty {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: var(--s3);
  padding: var(--s3);
  border: 1px dashed var(--border);
  border-radius: var(--r2);
  color: var(--text-faint);
  font-size: var(--f-sm);
}

.album__frame {
  /* 画框跟着图片的比例走：定死高度再按 ar 反算宽度，才不会在竖图两侧留一大片底色 */
  --ar: 0.667;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  height: min(420px, 56vh);
  aspect-ratio: var(--ar);
  max-width: 100%;
  margin-inline: auto;
  overflow: hidden;
  background: var(--bg-elev-2);
  border: 1px solid var(--border);
  border-radius: var(--r2);
}

.album__zoom {
  display: block;
  width: 100%;
  height: 100%;
  padding: 0;
  border: 0;
  background: none;
  cursor: zoom-in;
}

.album__zoom:focus-visible {
  outline: none;
  box-shadow: var(--ring);
}

.album__img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.album__nav {
  position: absolute;
  top: 50%;
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: var(--rp);
  background: var(--overlay);
  /* 半透明底上的字固定用 #fff，与海报灯箱同一套 */
  color: #fff;
  font-size: var(--f-lg);
  line-height: 1;
  transform: translateY(-50%);
  transition: background var(--dur) var(--ease);
}

.album__nav:hover {
  background: var(--bg-elev);
}

.album__nav--prev {
  left: var(--s2);
}

.album__nav--next {
  right: var(--s2);
}

.album__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--s3);
  font-size: var(--f-xs);
  color: var(--text-faint);
  font-variant-numeric: tabular-nums;
}

.album__actions {
  display: flex;
  align-items: center;
  gap: var(--s2);
}

/* 当前这张就是列表页那张脸时的标记，与全站胶囊同一套形状 */
.album__badge {
  display: inline-flex;
  align-items: center;
  height: var(--ctl-h-xs);
  padding-inline: var(--ctl-pad-x-xs);
  border-radius: var(--rp);
  background: var(--accent-soft);
  color: var(--accent);
  font-size: var(--f-xs);
  line-height: 1;
}

.album-lightbox {
  z-index: var(--z-lightbox);
  background: var(--overlay);
  backdrop-filter: blur(6px);
  cursor: zoom-out;
}

.album-lightbox__box {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--s2);
  max-width: 90vw;
  outline: none;
}

.album-lightbox__img {
  max-width: 100%;
  max-height: 82vh;
  object-fit: contain;
  border-radius: var(--r1);
  background: var(--bg-elev-2);
  box-shadow: var(--shadow-3);
  cursor: default;
}

/* 深色遮罩上的文字用 #fff，不套正文令牌 */
.album-lightbox__cap {
  color: #fff;
  font-size: var(--f-sm);
  text-align: center;
  word-break: break-all;
}

.album-lightbox__close {
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

.album-lightbox__close:hover {
  background: var(--bg-elev);
  color: var(--text);
}

.album-lightbox__nav {
  position: absolute;
  top: 50%;
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: var(--rp);
  background: var(--overlay);
  color: #fff;
  font-size: var(--f-xl);
  line-height: 1;
  transform: translateY(-50%);
  cursor: pointer;
  transition: background var(--dur) var(--ease);
}

.album-lightbox__nav:hover {
  background: var(--bg-elev);
}

.album-lightbox__nav--prev {
  left: calc(-1 * var(--s6));
}

.album-lightbox__nav--next {
  right: calc(-1 * var(--s6));
}
</style>
