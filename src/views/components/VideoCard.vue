<template>
  <div class="video-card" :class="[`mode-${mode}`, { selectable: selectable, selected }]" @click="handleClick">
    <div v-if="selectable" class="select-checkbox">
      <input type="checkbox" :checked="selected" @change.stop="handleSelect" />
    </div>
    <!-- 第一行：封面图片 -->
    <div class="video-cover">
      <img v-if="video.coverPath" :src="`/api/video/cover/${video.id}`" :alt="video.name" @error="$event.target.style.display='none'" />
      <div v-if="!video.coverPath" class="no-cover">{{ video.name?.charAt(0) || '?' }}</div>
    </div>
    <div class="video-body">
      <!-- 第二行：番号(code, 蓝色tag) + 名称(name, 加粗) -->
      <div class="info-row">
        <span v-if="video.code" class="code-tag">{{ video.code }}</span>
        <span class="name">{{ video.name }}</span>
      </div>
      <!-- 第三行：国家(tag, 紫色) + 分类(tag, 绿色) + 获赞数(红心) -->
      <div class="info-row">
        <span v-if="video.country" class="country-tag">{{ video.country }}</span>
        <span v-if="video.category" class="type-tag">{{ video.category }}</span>
        <span v-if="video.likeCount > 0" class="like-count">♥ {{ video.likeCount }}</span>
      </div>
      <!-- 第四行：所属系列名称（可点击，橙色tag） -->
      <div class="info-row" v-if="video.seriesName">
        <span class="series-tag clickable" @click.stop="goToSeries(video.seriesId)">{{ video.seriesName }}</span>
      </div>
      <div class="info-row" v-if="video.actorNames">
        <span
          v-for="item in parseActors(video.actorNames)"
          :key="item.id"
          class="actor-tag clickable"
          @click.stop="goToActor(item.id)"
        >{{ item.name }}</span>
      </div>
    </div>
    <!-- 第五行：操作按钮 -->
    <CardActions v-if="mode === 'full' && showActions" @click.stop>
      <button class="btn btn-primary" @click.stop="handleEdit">编辑</button>
      <button class="btn btn-success" @click.stop="goToDetail">详情</button>
    </CardActions>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'
import CardActions from './CardActions.vue'

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

const handleEdit = () => {
  emit('edit', props.video)
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
}

/* 第二行：名称样式 */
.info-row .name {
  font-size: 14px;
  font-weight: bold;
  color: #333;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 番号 tag - 蓝色 */
.code-tag {
  font-size: 12px;
  font-weight: bold;
  color: #1976d2;
  flex-shrink: 0;
  background: #e3f2fd;
  padding: 2px 6px;
  border-radius: 3px;
}

/* 国家 tag - 紫色 */
.country-tag {
  background: #f3e5f5;
  color: #7b1fa2;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 12px;
  white-space: nowrap;
}

/* 分类 tag - 绿色 */
.type-tag {
  background: #e8f5e9;
  color: #2e7d32;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 12px;
  white-space: nowrap;
}

/* 系列 tag - 橙色 */
.series-tag {
  background: #fff3e0;
  color: #e65100;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 12px;
  white-space: nowrap;
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

/* 获赞数 */
.like-count {
  font-size: 12px;
  color: #e74c3c;
  background: #fce4ec;
  padding: 2px 6px;
  border-radius: 3px;
  white-space: nowrap;
}
</style>
