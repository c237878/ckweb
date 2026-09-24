<template>
  <div v-if="!count" class="album album--empty">
    <span class="album__empty-text">{{ emptyText }}</span>
    <button type="button" class="btn btn--sm" :disabled="syncing" @click="sync">
      {{ syncing ? '同步中…' : '同步照片' }}
    </button>
  </div>

  <div v-else class="album">
    <!-- 重叠扇形：当前这张抬到正中、收成圆形当头像，其余按左右偏移斜着压在它后面。
         位置只由槽位号 --r 派生，所以"切换"就是改槽位，卡片移动全交给 CSS 过渡 -->
    <div
      class="album__fan"
      role="group"
      aria-roledescription="相册"
      :aria-label="`演员照片 ${index + 1} / ${count}，${name}`"
    >
      <button
        v-for="at in slots"
        :key="at.image.fileName"
        type="button"
        class="album__card"
        :class="{ 'is-current': at.r === 0, 'is-ghost': !at.visible }"
        :style="{ '--r': at.slot, '--d': Math.abs(at.slot), '--z': 9 - Math.abs(at.slot) }"
        :tabindex="at.r === 0 ? 0 : -1"
        :aria-label="at.r === 0
          ? `放大查看原图：${at.image.fileName}（左右方向键翻页）`
          : `看第 ${at.pos + 1} 张：${at.image.fileName}`"
        @click="at.r === 0 ? openZoom() : go(at.pos)"
        @keydown="at.r === 0 ? onKeydown($event) : null"
      >
        <img
          v-if="at.visible"
          class="album__img"
          :src="thumbUrl(at.image.fileName)"
          :alt="`${name} 照片 ${at.pos + 1}`"
          decoding="async"
        />
      </button>

      <button
        v-if="count > 1"
        type="button"
        class="album__nav album__nav--prev"
        aria-label="上一张"
        tabindex="-1"
        @click="step(-1)"
      >
        &lsaquo;
      </button>
      <button
        v-if="count > 1"
        type="button"
        class="album__nav album__nav--next"
        aria-label="下一张"
        tabindex="-1"
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
        <button
          type="button"
          class="btn btn--sm btn--ghost"
          :disabled="fetching"
          title="按姓名与曾用名去 av-wiki 的档案页找头像：只有唯一命中、且名字对得上才抓，拿不准就跳过"
          @click="emit('fetch-avatar')"
        >
          {{ fetching ? '抓取中…' : '抓头像' }}
        </button>
        <button type="button" class="btn btn--sm btn--ghost" :disabled="syncing" @click="sync">
          {{ syncing ? '同步中…' : '重新同步' }}
        </button>
      </div>
    </div>
  </div>

  <!-- 放大看原图：扇面里只有 400px 缩略图，要看细节得回源 -->
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
      <button type="button" class="album-lightbox__close" aria-label="关闭预览" @click="closeZoom">
        &times;
      </button>
    </figure>
  </div>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue'

/**
 * 演员相册：详情页头部右侧那一格。
 *
 * 排版是"一把摊开的照片"：当前这张抬到正中收成圆形头像，其余斜着压在它后面。
 * 卡片位置 = f(与当前张的槽位差)，切换时只是槽位差变了，于是 CSS 过渡把每张
 * 都滑到新位置 —— 不需要 JS 动画，也不会跳位。
 *
 * 图片清单来自 actor_images 表（由「同步照片」触发扫描），这里不再隐式扫盘。
 * 与「艳图」的 PosterWall 是两回事：那边一墙小图供浏览，这边逐张翻看并能放大。
 */
const props = defineProps({
  actorId: { type: String, required: true },
  /** [{ fileName, primary, width, height, size }]，后端已把主图排在第一位 */
  images: { type: Array, default: () => [] },
  name: { type: String, default: '' },
  emptyText: { type: String, default: '还没有照片' },
  syncing: { type: Boolean, default: false },
  fetching: { type: Boolean, default: false }
})

const emit = defineEmits(['sync', 'set-primary', 'fetch-avatar'])

// 扇面上摆 ±3 张。再多留几格缓冲是为了让卡片有"滑进来"的落点而不是凭空出现；
// 几百张图全建节点没意义，所以按窗口切片
const SPAN = 3
const BUFFER = 3

const key = ref('')
const zoomed = ref(false)
const zoomEl = ref(null)
let lastFocused = null

const count = computed(() => props.images.length)
// 当前看的是哪张按文件名记，不按序号：设为主图后后端会把那张挪到数组最前，
// 记序号的话翻页会跳去别的图片上
const current = computed(
  () => props.images.find((x) => x.fileName === key.value) || props.images[0] || {}
)
const index = computed(() => {
  const at = props.images.findIndex((x) => x.fileName === current.value.fileName)
  return at < 0 ? 0 : at
})

const slots = computed(() => {
  const out = []
  const from = Math.max(0, index.value - SPAN - BUFFER)
  const to = Math.min(props.images.length - 1, index.value + SPAN + BUFFER)
  for (let pos = from; pos <= to; pos++) {
    const r = pos - index.value
    out.push({
      image: props.images[pos],
      pos,
      r,
      slot: Math.max(-SPAN, Math.min(SPAN, r)),
      visible: Math.abs(r) <= SPAN
    })
  }
  return out
})

const thumbUrl = (fileName) => `/api/actor/${props.actorId}/thumb/m/${encodeURIComponent(fileName)}`
const posterUrl = (fileName) => `/api/actor/${props.actorId}/poster/${encodeURIComponent(fileName)}`

const mb = (bytes) => (bytes ? `${(bytes / 1048576).toFixed(1)} MB` : '')

const go = (pos) => {
  const img = props.images[pos]
  if (img) key.value = img.fileName
}

const step = (delta) => {
  const n = count.value
  if (n < 2) return
  go((index.value + delta + n) % n)
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

.album__fan {
  position: relative;
  height: 200px;
  /* 侧栏窄的时候最外层的卡片会探出去一点，裁掉即可，别撑出横向滚动 */
  overflow: hidden;
}

.album__card {
  position: absolute;
  top: 12px;
  /* 横向偏移用百分比：窄栏里扇形自动收拢，不会顶到左边文字那一栏 */
  left: calc(50% + var(--r) * 13.5%);
  width: 124px;
  height: 124px;
  padding: 0;
  overflow: hidden;
  background: var(--bg-elev-2);
  border: 1px solid var(--border);
  /* 圆角只给当前这张：它是头像；其余保持方角，才有"照片"的样子 */
  border-radius: 12px;
  box-shadow: var(--shadow-2);
  z-index: var(--z);
  /* --d 越大压得越低、缩得越小，扇形才有前后层次 */
  transform: translateX(-50%) translateY(calc(var(--d) * 11px)) rotate(calc(var(--r) * 8deg))
    scale(calc(1 - var(--d) * 0.09));
  transition: transform 380ms cubic-bezier(.22, .61, .36, 1),
    border-radius 380ms cubic-bezier(.22, .61, .36, 1), width 380ms cubic-bezier(.22, .61, .36, 1),
    height 380ms cubic-bezier(.22, .61, .36, 1), top 380ms cubic-bezier(.22, .61, .36, 1),
    opacity 260ms var(--ease), box-shadow var(--dur) var(--ease);
}

.album__card.is-current {
  top: 26px;
  width: 148px;
  height: 148px;
  border-radius: 50%;
  border-color: var(--border-strong);
  box-shadow: var(--shadow-3);
  transform: translateX(-50%) scale(1);
  cursor: zoom-in;
}

.album__card:not(.is-current):hover {
  /* 侧面的卡片抬一点，摆明"点得动" */
  transform: translateX(-50%) translateY(calc(var(--d) * 11px - 8px)) rotate(calc(var(--r) * 8deg))
    scale(calc(1.04 - var(--d) * 0.09));
}

.album__card:focus-visible {
  outline: none;
  box-shadow: var(--ring), var(--shadow-3);
}

/* 滑出扇面的那些：停在边上并淡掉。位置仍然连续，所以滑进来时是移动而不是闪现 */
.album__card.is-ghost {
  opacity: 0;
  pointer-events: none;
}

.album__img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  pointer-events: none;
}

/* 圆里要看到的是脸：竖构图的照片裁中间会只剩腰，所以取上三分 */
.album__card.is-current .album__img {
  object-position: center 18%;
}

.album__nav {
  position: absolute;
  top: 84px;
  z-index: 20;
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border-radius: var(--rp);
  background: var(--overlay);
  /* 半透明底上的字固定用 #fff，与海报灯箱同一套 */
  color: #fff;
  font-size: var(--f-lg);
  line-height: 1;
  transition: background var(--dur) var(--ease);
}

.album__nav:hover {
  background: var(--bg-elev);
}

.album__nav--prev {
  left: 0;
}

.album__nav--next {
  right: 0;
}

.album__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--s3);
  flex-wrap: wrap;
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
