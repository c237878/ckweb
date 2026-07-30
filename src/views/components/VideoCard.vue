<template>
  <div class="video-card" :title="video.code + ' ' + video.name" :class="[`mode-${mode}`, { selectable: selectable, selected }]" @click="handleClick">
    <div v-if="selectable" class="select-checkbox">
      <input type="checkbox" :checked="selected" @change.stop="handleSelect" />
    </div>
    <!-- 第一行：封面图片 -->
    <div class="video-cover">
      <img v-if="video.coverPath" :src="`/api/video/cover/${video.id}`" :alt="video.name" @error="$event.target.style.display='none'" />
      <div v-if="!video.coverPath" class="no-cover">{{ video.name?.charAt(0) || '?' }}</div>
      <!-- file_size=0 时显示灰色蒙版 -->
      <div v-if="!video.fileSize || video.fileSize === 0" class="cover-mask">
      </div>
    </div>
    <div class="video-body">
      <!-- 第二行：番号(code, 蓝色tag) + 名称(name, 加粗) -->
      <div class="info-row">
        <div class="name">
          <span v-if="video.code">{{ video.code }}</span>
          <span>{{ video.name }}</span>
        </div>
      </div>
      <!-- 第三行：国家(tag, 紫色) + 分类(tag, 绿色) + 获赞数(红心) -->
      <div class="info-row" v-if="mode!='brief'">
        <span v-if="video.country" class="country-tag">{{ video.country }}</span>
        <span v-if="video.category && mode=='full'" class="type-tag">{{ video.category }}</span>
        <span v-if="video.likeCount > 0" class="like-count">♥ {{ video.likeCount }}</span>
        <span class="file-size" @click.stop="copyCode" title="点击复制番号">{{ video.fileSize ? formatSize(video.fileSize) : '无文件' }}</span>
        <span v-if="video.mediaAttrFlags > 0" class="media-flag-tag" :class="'media-' + video.mediaAttrFlags">{{ mediaFlagsText[video.mediaAttrFlags] }}</span>
      </div>
      <!-- 第四行：所属系列名称（可点击，橙色tag） -->
      <div class="info-row" v-if="video.seriesName && mode!='brief'">
        <span class="series-tag clickable" @click.stop="goToSeries(video.seriesId)">{{ video.seriesName }}</span>
      </div>
      <!-- 第五行：演员名称（可点击，蓝色tag） -->
      <div class="info-row actors" v-if="video.actorNames">
        <span
          v-for="item in parseActors(video.actorNames)"
          :key="item.id"
          class="actor-tag clickable"
          @click.stop="goToActor(item.id)"
        >{{ item.name }}</span>
      </div>
    </div>
    <!-- 第六行：操作按钮 -->
    <CardActions v-if="mode === 'full' && showActions" @click.stop>
      <button class="btn" @click.stop="handleReset" :disabled="resetting">{{ resetting ? '重置中...' : '重置' }}</button>
      <button class="btn btn-primary" @click.stop="handleEdit">编辑</button>
      <button class="btn btn-success" @click.stop="goToDetail">详情</button>
    </CardActions>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import CardActions from './CardActions.vue'
import { formatSize } from '@/scripts/utils/format'
import { videoApi } from '@/scripts/api'

const props = defineProps({
  video: {
    type: Object,
    required: true
  },
  mode: {
    type: String,
    default: 'full', // 'full' | 'display' | 'brief'
  },
  showActions: {
    type: Boolean,
    default: true
  },
  selectable: {
    type: Boolean,
    default: false
  },
  selected: {
    type: Boolean,
    default: false
  }
})

const router = useRouter()
const emit = defineEmits(['edit', 'select'])

const mediaFlagsText = { 1: '劣质', 2: '无字幕', 3: '完美' }

const copyCode = async (e) => {
  e.stopPropagation()
  const code = props.video.code || ''
  if (!code) return
  try {
    await navigator.clipboard.writeText(code)
  } catch {
    // 兜底
    const ta = document.createElement('textarea')
    ta.value = code
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
  }
}

const handleClick = () => {
  if (props.selectable) {
    handleSelect()
  } else {
    goToDetail()
  }
}

const handleSelect = () => {
  emit('select', props.video.id)
}

const goToDetail = () => {
  router.push(`/video/${props.video.id}`)
}

const goToSeries = (seriesId) => {
  if (seriesId) {
    router.push(`/series/${seriesId}`)
  }
}

const parseActors = (str) => {
  if (!str) return []
  return str.split(',').map(part => {
    const idx = part.indexOf('|')
    if (idx === -1) return { id: '', name: part }
    return { id: part.slice(0, idx), name: part.slice(idx + 1) }
  })
}

const goToActor = (actorId) => {
  if (actorId) router.push(`/actor/${actorId}`)
}

const resetting = ref(false)
const handleReset = async () => {
  if (!props.video?.id || resetting.value) return
  resetting.value = true
  try {
    const res = await videoApi.resetFileSize(props.video.id)
    if (res.success) {
      if (res.data?.fileSize !== undefined) props.video.fileSize = res.data.fileSize
      if (res.data?.filePath !== undefined) props.video.filePath = res.data.filePath
      if (res.data?.coverPath !== undefined) props.video.coverPath = res.data.coverPath
    } else {
      alert('重置失败: ' + (res.message || '未知错误'))
    }
  } catch (error) {
    alert('重置失败: ' + (error.message || error))
  } finally {
    resetting.value = false
  }
}

const handleEdit = () => {
  emit('edit', props.video)
}

// URL解码函数
const decodeUrl = (url) => {
  try {
    return decodeURIComponent(url)
  } catch {
    return url
  }
}
</script>

<style scoped>
.video-card {
  cursor: pointer;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition: box-shadow 0.3s;
  background: #fff;
  display: flex;
  flex-direction: column;
  position: relative;
}

.video-card:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.18);
}

.video-card.selected {
  box-shadow: 0 0 0 3px #3498db;
}

.video-card.selectable {
  cursor: pointer;
}

.video-cover {
  position: relative;
  width: 100%;
  padding-top: 66.56%; /* 3:2 比例 */
  background: #f0f0f0;
  overflow: hidden;
}

.select-checkbox {
  position: absolute;
  top: 8px;
  left: 8px;
  z-index: 10;
  cursor: pointer;
}

.select-checkbox input[type="checkbox"] {
  width: 20px;
  height: 20px;
  cursor: pointer;
}

.video-cover img {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.no-cover {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #999;
  font-size: 14px;
}

/* 灰色蒙版 - file_size=0 */
.cover-mask {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(128, 128, 128, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.mask-text {
  color: #fff;
  font-size: 14px;
  font-weight: bold;
  padding: 6px 12px;
  background: rgba(0, 0, 0, 0.5);
  border-radius: 4px;
}

.video-body {
  padding: 12px 16px;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

/* 统一信息行样式 - 每一行都是 flex + gap */
.info-row {
  display: flex;
  align-items: center;
  gap: 6px;
  overflow: hidden;
  height: 21px;
}

.info-row.actors {
  flex-wrap: wrap;
}
.mode-brief .info-row.actors {
  flex-wrap: nowrap;
}

/* 第二行：名称样式 */
 .info-row .name {
  width: 100%;
  font-size: 14px;
  font-weight: bold;
  color: #333;
  display: flex;
  align-items: center;
  gap: 4px;
}

.info-row .name span {
  width: auto;
  height: 20px;
  line-height: 20px;
  white-space: nowrap;
}

.info-row .name span:last-child {
  overflow: hidden;
  text-overflow: ellipsis;
}

.clickable {
  cursor: pointer;
}

.clickable:hover {
  background: #ffe0b2;
}

.actor-tag {
  background: #e3f2fd;
  color: #1565c0;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 12px;
  white-space: nowrap;
}

.more-tag {
  font-size: 12px;
  color: #999;
}

/* tag 样式 */
.country-tag, .type-tag, .series-tag, .like-count, .file-size {
  width: auto;
  height: 20px;
  line-height: 20px;
  padding: 0 6px;
  border-radius: 3px;
  font-size: 12px;
  white-space: nowrap;
}
/* 国家 tag - 紫色 */
.country-tag {
  background: #f3e5f5;
  color: #7b1fa2;
}
/* 分类 tag - 绿色 */
.type-tag {
  background: #e8f5e9;
  color: #2e7d32;
}
/* 系列 tag - 橙色 */
.series-tag {
  background: #fff3e0;
  color: #e65100;
}
/* 获赞数 */
.like-count {
  color: #e74c3c;
  background: #fce4ec;
}
/* 文件大小 */
.file-size {
  color: #555;
  background: #f0f0f0;
  cursor: pointer;
}

.media-flag-tag {
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 3px;
  font-weight: 600;
  white-space: nowrap;
}

.media-flag-tag.media-1 { background: #fee; color: #c0392b; }
.media-flag-tag.media-2 { background: #fff3cd; color: #856404; }
.media-flag-tag.media-3 { background: #d4edda; color: #155724; }
</style>
