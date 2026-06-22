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
      <!-- 第二行：影片名称（加粗，有番号组合显示） -->
      <div class="row1">
        <span v-if="video.code" class="code">{{ video.code }}</span>
        <span class="name">{{ video.name }}</span>
      </div>
      <!-- 第三行：地区、分类、获赞总数（>0显示） -->
      <div class="row2">
        <span v-if="video.country" class="country-tag">{{ video.country }}</span>
        <span v-if="video.category" class="type-tag">{{ video.category }}</span>
        <span v-if="video.likeCount > 0" class="like-count">♥ {{ video.likeCount }}</span>
      </div>
      <!-- 第四行：所属系列（点击跳转系列详情页） -->
      <div class="row3" v-if="video.seriesName">
        <span class="series-tag clickable" @click.stop="goToSeries(video.seriesId)">{{ video.seriesName }}</span>
      </div>
    </div>
    <!-- 第五行：操作按钮 -->
    <div v-if="mode === 'full' && showActions" class="card-actions" @click.stop>
      <button class="edit-btn" @click.stop="handleEdit">编辑</button>
      <button class="detail-btn" @click.stop="goToDetail">详情</button>
    </div>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'

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
    router.push(`/series`)
    // 或者将来有系列详情页的话：router.push(`/series/${seriesId}`)
  }
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
  padding-top: 67.25%;
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

/* 第二行：名称 + 番号 */
.row1 {
  display: flex;
  align-items: center;
  gap: 8px;
  overflow: hidden;
}

.code {
  font-size: 13px;
  font-weight: bold;
  color: #1976d2;
  flex-shrink: 0;
  background: #e3f2fd;
  padding: 1px 6px;
  border-radius: 3px;
}

.name {
  font-size: 14px;
  font-weight: bold;
  color: #333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 第三行：地区、分类、获赞 */
.row2 {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #666;
  overflow: hidden;
  flex-wrap: wrap;
}

.like-count {
  font-size: 12px;
  color: #e74c3c;
  background: #fce4ec;
  padding: 1px 6px;
  border-radius: 3px;
  white-space: nowrap;
}

.series-tag {
  background: #fff3e0;
  color: #e65100;
  padding: 1px 6px;
  border-radius: 3px;
  white-space: nowrap;
}

.clickable {
  cursor: pointer;
}

.clickable:hover {
  background: #ffe0b2;
}

.type-tag {
  background: #e8f5e9;
  color: #2e7d32;
  padding: 1px 6px;
  border-radius: 3px;
  white-space: nowrap;
}

.country-tag {
  background: #f3e5f5;
  color: #7b1fa2;
  padding: 1px 6px;
  border-radius: 3px;
  white-space: nowrap;
}

/* 第四行：所属系列 */
.row3 {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #666;
}

.card-actions {
  padding: 8px 16px;
  display: flex;
  justify-content: flex-end;
  border-top: 1px solid #f5f5f5;
}

.edit-btn {
  padding: 4px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  transition: opacity 0.3s;
  background: #3498db;
  color: white;
}

.edit-btn:hover {
  opacity: 0.8;
}

.detail-btn {
  padding: 4px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  transition: opacity 0.3s;
  background: #2ecc71;
  color: white;
  margin-right: auto;
}

.detail-btn:hover {
  opacity: 0.8;
}
</style>
