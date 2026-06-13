<template>
  <div class="video-card" :class="[`mode-${mode}`]" @click="goToDetail">
    <div class="video-cover">
      <img v-if="video.id" :src="`/api/video/cover/${video.id}`" :alt="video.name" />
      <div v-else class="no-cover">暂无封面</div>
      <span v-if="video.quality" class="quality-badge">{{ video.quality }}</span>
    </div>
    <div class="video-body">
      <!-- 完全模式 / 展示模式 -->
      <template v-if="mode !== 'brief'">
        <div class="row1">
          <span v-if="video.code" class="code">{{ video.code }}</span>
          <span class="name">{{ video.name }}</span>
        </div>
        <div class="row2" v-if="video.category || (video.actors && video.actors.length > 0)">
          <span v-if="video.category" class="type-tag">{{ video.category }}</span>
          <span v-if="video.actors && video.actors.length > 0" class="actors">
            {{ video.actors.map(a => a.name).join(', ') }}
          </span>
        </div>
      </template>
      <!-- 简介模式 -->
      <template v-else>
        <div class="brief-name">{{ video.name }}</div>
        <div class="brief-actors" v-if="video.actors && video.actors.length > 0">
          {{ video.actors.map(a => a.name).join(', ') }}
        </div>
      </template>
    </div>
    <!-- 完全模式才显示操作按钮 -->
    <div v-if="mode === 'full' && showActions" class="card-actions" @click.stop>
      <button class="edit-btn" @click.stop="handleEdit">编辑</button>
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
  }
})

const router = useRouter()
const emit = defineEmits(['edit'])

const goToDetail = () => {
  router.push(`/video/${props.video.id}`)
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
  transition: transform 0.3s, box-shadow 0.3s;
  background: #fff;
  display: flex;
  flex-direction: column;
}

.video-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
}

/* 简介模式：更小巧 */
.mode-brief {
  font-size: 12px;
}

.video-cover {
  position: relative;
  width: 100%;
  padding-top: 67.25%;
  background: #f0f0f0;
  overflow: hidden;
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

.quality-badge {
  position: absolute;
  top: 10px;
  right: 10px;
  background: rgba(0, 0, 0, 0.6);
  color: white;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
}

.video-body {
  padding: 12px 16px;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.row1 {
  display: flex;
  align-items: center;
  gap: 8px;
  overflow: hidden;
}

.code {
  font-size: 14px;
  font-weight: bold;
  color: #333;
  flex-shrink: 0;
}

.name {
  font-size: 14px;
  font-weight: bold;
  color: #333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row2 {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #666;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.type-tag {
  white-space: nowrap;
  flex-shrink: 0;
}

.actors {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 简介模式样式 */
.brief-name {
  font-size: 13px;
  font-weight: 600;
  color: #333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.brief-actors {
  font-size: 11px;
  color: #999;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
</style>
