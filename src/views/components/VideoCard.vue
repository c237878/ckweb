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
      <div class="info-row info-row--name">
        <router-link class="name card-title" :to="`/video/${video.id}`" @click.stop>
          <span v-if="video.code" class="name-code">{{ video.code }}</span>
          <span class="name-text" :title="`${video.code ? video.code + ' ' : ''}${video.name}`">{{ video.name }}</span>
        </router-link>
      </div>

      <!-- 状态 + 属性：片源是状态所以用药丸，大小/点赞/地区/分类不可点，用文本。
           逐项按卡片宽度放开，见文件末尾 @container -->
      <div class="info-row info-row--spec">
        <span
          v-if="video.mediaAttrFlags > 0"
          class="tag"
          :class="mediaFlagClass(video.mediaAttrFlags)"
        >{{ mediaFlagText(video.mediaAttrFlags) }}</span>
        <span class="facts" v-if="hasFacts">
          <span class="fact fact--size">{{ video.fileSize ? formatSize(video.fileSize) : '无文件' }}</span>
          <span v-if="video.likeCount > 0" class="fact fact--likes">♥ {{ video.likeCount }}</span>
          <span v-if="video.country" class="fact fact--country">{{ video.country }}</span>
          <span v-if="video.category && mode === 'full'" class="fact fact--category">{{ video.category }}</span>
        </span>
      </div>

      <div class="info-row info-row--series" v-if="video.seriesName && mode !== 'brief'">
        <router-link class="tag tag--info" :to="`/series/${video.seriesId}`" @click.stop>
{{ video.seriesName }}
</router-link>
      </div>

      <div class="info-row info-row--actors" v-if="actorList.length && mode !== 'brief'">
        <router-link
          v-for="actor in actorList"
          :key="actor.id || actor.name"
          class="tag actor-tag"
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

const props = defineProps({
  video: { type: Object, required: true },
  /** full = 列表页（全部标签）；display = 首页板块；brief = 紧凑行 */
  mode: { type: String, default: 'full' },
  /** 点整张卡片做什么：browse 进详情 / select 勾选 / pick 选一个去编辑 */
  clickAction: { type: String, default: 'browse' },
  selectable: { type: Boolean, default: false },
  selected: { type: Boolean, default: false }
})

const router = useRouter()
const emit = defineEmits(['select', 'pick'])

const coverFailed = ref(false)
const isPortrait = ref(false)

// 属性行只要有一项可显示才渲染，否则空行占高
const hasFacts = computed(() =>
  !!props.video.fileSize || props.video.likeCount > 0 || !!props.video.country ||
  (props.mode === 'full' && !!props.video.category)
)

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

const handleClick = () => {
  if (props.clickAction === 'select') handleSelect()
  else if (props.clickAction === 'pick') emit('pick', props.video)
  else goToDetail()
}

const handleSelect = () => emit('select', props.video.id)
const goToDetail = () => router.push(`/video/${props.video.id}`)
</script>

<style scoped>
.video-card {
  display: flex;
  flex-direction: column;
  position: relative;
  cursor: pointer;
  /* 让卡片自己成为查询容器：信息分级看卡片实际宽度，而不是视口宽度 */
  container-type: inline-size;
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

.info-row--actors {
  flex-wrap: wrap;
}

.mode-brief .info-row--actors {
  flex-wrap: nowrap;
}

/* 信息分级：窄卡片只留封面 + 番号名称，卡片变宽才逐级补齐。
   阈值针对卡片自身宽度（由 grid 列数决定），不是视口宽度。 */
.info-row--spec,
.info-row--series,
.info-row--actors {
  display: none;
}

.fact--likes,
.fact--country,
.fact--category {
  display: none;
}

@container (min-width: 200px) {
  .info-row--spec {
    display: flex;
  }
}

@container (min-width: 240px) {
  .fact--likes,
  .fact--country {
    display: inline;
  }
}

@container (min-width: 280px) {
  .fact--category,
  .info-row--series {
    display: flex;
  }
  .fact--category {
    display: inline;
  }
}

@container (min-width: 320px) {
  .info-row--actors {
    display: flex;
  }
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

/* 可点药丸的 hover 统一走全局 a.tag / button.tag，这里只留配色差异 */
.actor-tag {
  color: var(--text-dim);
  background: var(--bg-elev-2);
}
</style>
