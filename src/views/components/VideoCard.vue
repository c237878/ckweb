<template>
  <article
    class="video-card card"
    :class="[`mode-${mode}`, { selected, selectable }]"
    @click="handleClick"
  >
    <div v-if="selectable" class="select-checkbox" @click.stop>
      <input
        type="checkbox"
        :checked="selected"
        :aria-label="`选择 ${video.name}`"
        @change="handleSelect"
      />
    </div>

    <!-- 封面：容器固定宽高比，图片迟到也不塌陷；加载失败留首字占位而不是隐藏 -->
    <div class="cover video-cover" :class="{ 'cover--fit': isPortrait }">
      <img
        v-if="video.coverPath && !coverFailed"
        :src="coverUrl"
        :alt="video.name || '影片封面'"
        loading="lazy"
        decoding="async"
        @load="onCoverLoad"
        @error="coverFailed = true"
      />
      <span v-else class="cover-fallback">{{ video.name?.charAt(0) || '?' }}</span>
      <div v-if="!video.fileSize" class="cover-mask">
        <span class="mask-badge">无文件</span>
      </div>
    </div>

    <div class="video-body">
      <router-link class="name card-title" :to="`/video/${video.id}`" @click.stop>
        <span v-if="video.code" class="name-code">{{ video.code }}</span>
        <span class="name-text" :title="`${video.code ? video.code + ' ' : ''}${video.name}`">{{ video.name }}</span>
      </router-link>

      <!-- 所有胶囊同一行，放不下就换行。外观一致，只有可点的那几个有 hover
           ——由全局 a.tag:hover / button.tag:hover 负责，span 天然拿不到。
           逐项按卡片自身宽度放开，见文末 @container -->
      <div class="pills">
        <span
          v-if="video.mediaAttrFlags > 0"
          class="tag pill pill--flag"
          :class="mediaFlagClass(video.mediaAttrFlags)"
        >{{ mediaFlagText(video.mediaAttrFlags) }}</span>

        <button
          v-if="mode === 'full'"
          type="button"
          class="tag pill pill--size"
          :title="copied ? '已复制番号' : '点击复制番号；无文件时顺带重扫路径'"
          @click.stop="copyCode"
        >
{{ copied ? '已复制' : (video.fileSize ? formatSize(video.fileSize) : '无文件') }}
</button>
        <span v-else class="tag pill pill--size">{{ video.fileSize ? formatSize(video.fileSize) : '无文件' }}</span>

        <span v-if="video.likeCount > 0" class="tag tag--like pill pill--likes">♥ {{ video.likeCount }}</span>
        <span v-if="video.country" class="tag tag--accent pill pill--country">{{ video.country }}</span>
        <span v-if="video.category && mode === 'full'" class="tag tag--success pill pill--category">{{ video.category }}</span>

        <router-link
          v-if="video.seriesName && mode !== 'brief'"
          class="tag tag--info pill pill--series"
          :to="`/series/${video.seriesId}`"
          @click.stop
        >
{{ video.seriesName }}
</router-link>

        <router-link
          v-for="actor in actorList"
          :key="actor.id || actor.name"
          class="tag pill pill--actor"
          :to="`/actor/${actor.id}`"
          @click.stop
        >
{{ actor.name }}
</router-link>
      </div>
    </div>
  </article>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { formatSize } from '@/scripts/utils/format'
import { mediaFlagText, mediaFlagClass } from '@/scripts/constants'
import { videoApi } from '@/scripts/api'
import { useUiStore, errText } from '@/scripts/store/ui'

const props = defineProps({
  video: { type: Object, required: true },
  /** full = 列表页（全部胶囊）；display = 首页板块；brief = 紧凑行 */
  mode: { type: String, default: 'full' },
  /** 点整张卡片做什么：browse 进详情 / select 勾选 / pick 选一个去编辑 */
  clickAction: { type: String, default: 'browse' },
  selectable: { type: Boolean, default: false },
  selected: { type: Boolean, default: false }
})

const router = useRouter()
const ui = useUiStore()
const emit = defineEmits(['select', 'pick'])

const resetting = ref(false)
const coverFailed = ref(false)
const copied = ref(false)
const isPortrait = ref(false)

// 重置接口返回的字段覆盖在本地，不回写 props（改 prop 会让列表数据与卡片悄悄分叉）
const patch = ref({})
const video = computed(() => ({ ...props.video, ...patch.value }))

// 封面比例并不统一（800x538 为主，也有 16:9 和手机竖屏 1080x1920）。
// 竖屏图塞进 3:2 盒子会被裁到只剩中间一条，所以改成留边完整显示。
const onCoverLoad = (event) => {
  const img = event.target
  isPortrait.value = img.naturalHeight > img.naturalWidth
}

const coverUrl = computed(() => videoApi.getCoverUrl(props.video.id))

// 后端把演员拼成 "id|name,id|name" 一个字符串下发，这里拆开
const actorList = computed(() => {
  if (!props.video.actorNames) return []
  return props.video.actorNames.split(',').map((part) => {
    const idx = part.indexOf('|')
    return idx === -1 ? { id: '', name: part } : { id: part.slice(0, idx), name: part.slice(idx + 1) }
  })
})

const copyCode = async () => {
  const code = props.video.code || ''
  if (!code) return
  try {
    await navigator.clipboard.writeText(code)
    copied.value = true
    setTimeout(() => { copied.value = false }, 1500)
  } catch {
    // 非安全上下文（局域网 http 直连）下 clipboard 不可用，退回 execCommand
    const ta = document.createElement('textarea')
    ta.value = code
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
    copied.value = true
    setTimeout(() => { copied.value = false }, 1500)
  }

  // 无文件时复制番号顺带触发一次路径重扫
  if (!video.value.fileSize) handleReset()
}

const handleReset = async () => {
  if (!props.video?.id || resetting.value) return
  resetting.value = true
  try {
    const res = await videoApi.resetFileSize(props.video.id)
    if (res.success) {
      patch.value = { ...patch.value, ...(res.data ?? {}) }
      if (res.data?.coverPath !== undefined) coverFailed.value = false
      ui.success('已重置')
    } else {
      ui.error('重置失败：' + errText(res, '未知错误'))
    }
  } catch (error) {
    console.error('重置失败:', error)
    ui.error('重置失败：' + errText(error))
  } finally {
    resetting.value = false
  }
}

const handleSelect = () => emit('select', props.video.id)
const goToDetail = () => router.push(`/video/${props.video.id}`)

const handleClick = () => {
  if (props.clickAction === 'select') handleSelect()
  else if (props.clickAction === 'pick') emit('pick', props.video)
  else goToDetail()
}
</script>

<style scoped>
.video-card {
  display: flex;
  flex-direction: column;
  position: relative;
  cursor: pointer;
  /* 让卡片自己成为查询容器：胶囊放不放得下看卡片实际宽度，而不是视口宽度 */
  container-type: inline-size;
}

.video-card.selected {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--accent-soft), var(--shadow-2);
}

/* hover 只换光影，不做位移 */
.video-card:hover {
  border-color: var(--border-strong);
  box-shadow: var(--shadow-2);
}

.video-cover {
  flex-shrink: 0;
  background: var(--bg-elev-2);
}

/* 竖屏封面：完整显示，两侧留底色而不是硬裁 */
.cover--fit img {
  object-fit: contain;
  padding: 4px;
}

.select-checkbox {
  position: absolute;
  top: var(--s2);
  left: var(--s2);
  z-index: 2;
}

.select-checkbox input[type="checkbox"] {
  width: 18px;
  height: 18px;
  cursor: pointer;
  accent-color: var(--accent);
}

.cover-mask {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgba(8, 10, 14, .52);
  pointer-events: none;
}

.mask-badge {
  padding: 2px 9px;
  border-radius: var(--rp);
  background: rgba(8, 10, 14, .72);
  color: #fff;
  font-size: var(--f-xs);
  letter-spacing: .5px;
}

.video-body {
  padding: var(--s3);
  display: flex;
  flex-direction: column;
  gap: var(--s2);
  min-width: 0;
  flex: 1;
}

.name {
  display: flex;
  align-items: baseline;
  gap: 5px;
  width: 100%;
}

.name:hover .name-text {
  color: var(--accent);
}

.name-code {
  color: var(--accent);
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}

.name-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: color var(--dur) var(--ease);
}

/* 一行摆开，放不下换行；行列间距同值，看着才是一堆胶囊而不是一表格式的行 */
.pills {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s1);
  min-width: 0;
}

.pill {
  max-width: 100%;
}

/* 胶囊一律同行、放不下换行，所以不再逐项隐藏。
   只有演员设了门槛：一部片可能挂十几个演员，全渲染会让卡片高度失控 */
.pill--actor {
  display: none;
}

@container (min-width: 240px) {
  .pill--actor {
    display: inline-flex;
  }
}
</style>
