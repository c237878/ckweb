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
        v-if="shown.coverPath && !coverFailed"
        :src="coverUrl"
        :alt="shown.name || '影片封面'"
        loading="lazy"
        decoding="async"
        @load="onCoverLoad"
        @error="coverFailed = true"
      />
      <span v-else class="cover-fallback">{{ shown.name?.charAt(0) || '?' }}</span>
      <div v-if="!shown.fileSize" class="cover-mask">
        <span class="mask-badge">无文件</span>
      </div>
    </div>

    <div class="video-body">
      <div class="info-row">
        <router-link class="name card-title" :to="`/video/${shown.id}`" @click.stop>
          <span v-if="shown.code" class="name-code">{{ shown.code }}</span>
          <span class="name-text" :title="`${shown.code ? shown.code + ' ' : ''}${shown.name}`">{{ shown.name }}</span>
        </router-link>
      </div>

      <div class="info-row" v-if="mode !== 'brief'">
        <span v-if="shown.country" class="tag tag--accent">{{ shown.country }}</span>
        <span v-if="shown.category && mode === 'full'" class="tag tag--success">{{ shown.category }}</span>
        <span v-if="shown.likeCount > 0" class="tag tag--like">♥ {{ shown.likeCount }}</span>
        <button
          v-if="mode === 'full'"
          type="button"
          class="tag file-size"
          :title="copied ? '已复制番号' : '点击复制番号'"
          @click.stop="copyCode"
        >
{{ copied ? '已复制' : (shown.fileSize ? formatSize(shown.fileSize) : '无文件') }}
</button>
        <span v-else class="tag file-size">{{ shown.fileSize ? formatSize(shown.fileSize) : '无文件' }}</span>
        <span
          v-if="shown.mediaAttrFlags > 0"
          class="tag"
          :class="mediaFlagClass(shown.mediaAttrFlags)"
        >{{ mediaFlagText(shown.mediaAttrFlags) }}</span>
      </div>

      <div class="info-row" v-if="shown.seriesName && mode !== 'brief'">
        <button
          type="button"
          class="tag tag--info clickable"
          @click.stop="goToSeries(shown.seriesId)"
        >
{{ shown.seriesName }}
</button>
      </div>

      <div class="info-row actors" v-if="actorList.length">
        <button
          v-for="actor in actorList"
          :key="actor.id || actor.name"
          type="button"
          class="tag clickable actor-tag"
          @click.stop="goToActor(actor.id)"
        >
{{ actor.name }}
</button>
      </div>
    </div>

    <CardActions v-if="mode === 'full' && showActions" @click.stop>
      <button class="btn btn--sm" @click.stop="handleReset" :disabled="resetting">
        {{ resetting ? '重置中...' : '重置' }}
      </button>
      <button class="btn btn--sm btn--primary" @click.stop="handleEdit">编辑</button>
      <button class="btn btn--sm" @click.stop="goToDetail">详情</button>
    </CardActions>
  </article>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import CardActions from './CardActions.vue'
import { formatSize } from '@/scripts/utils/format'
import { mediaFlagText, mediaFlagClass } from '@/scripts/constants'
import { videoApi } from '@/scripts/api'
import { useUiStore, errText } from '@/scripts/store/ui'

const props = defineProps({
  video: { type: Object, required: true },
  /** full = 列表页（带操作与全部标签）；display = 首页板块；brief = 紧凑行 */
  mode: { type: String, default: 'full' },
  showActions: { type: Boolean, default: true },
  selectable: { type: Boolean, default: false },
  selected: { type: Boolean, default: false }
})

const router = useRouter()
const ui = useUiStore()
const emit = defineEmits(['edit', 'select'])

const resetting = ref(false)
const coverFailed = ref(false)
const copied = ref(false)
const isPortrait = ref(false)

// 重置接口返回的字段覆盖在本地，不回写 props
const patch = ref({})
const shown = computed(() => ({ ...props.video, ...patch.value }))

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
  if (!shown.value.fileSize) handleReset()
}

const handleClick = () => {
  if (props.selectable) handleSelect()
  else goToDetail()
}

const handleSelect = () => emit('select', props.video.id)
const goToDetail = () => router.push(`/video/${props.video.id}`)
const goToSeries = (seriesId) => { if (seriesId) router.push(`/series/${seriesId}`) }
const goToActor = (actorId) => { if (actorId) router.push(`/actor/${actorId}`) }
const handleEdit = () => emit('edit', props.video)

const handleReset = async () => {
  if (!props.video?.id || resetting.value) return
  resetting.value = true
  try {
    const res = await videoApi.resetFileSize(props.video.id)
    if (res.success) {
      // 只覆盖本卡片显示的值，不去改父组件传进来的对象（改 prop 会让列表数据与卡片悄悄分叉）
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
</script>

<style scoped>
.video-card {
  display: flex;
  flex-direction: column;
  position: relative;
  cursor: pointer;
}

.video-card.selected {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--accent-soft), var(--shadow-2);
}

.video-card:hover {
  transform: translateY(-3px);
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
  gap: 6px;
  min-width: 0;
  flex: 1;
}

.info-row {
  display: flex;
  align-items: center;
  gap: 5px;
  min-height: 21px;
  overflow: hidden;
}

.info-row.actors {
  flex-wrap: wrap;
}

.mode-brief .info-row.actors {
  flex-wrap: nowrap;
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

.clickable {
  cursor: pointer;
}

.clickable:hover {
  filter: brightness(1.18);
}

.actor-tag {
  color: var(--text-dim);
  background: var(--bg-elev-2);
}

.file-size {
  margin-left: auto;
  color: var(--text-faint);
  border: 1px solid transparent;
  cursor: pointer;
}

.file-size:hover {
  color: var(--text);
  border-color: var(--border);
}
</style>
