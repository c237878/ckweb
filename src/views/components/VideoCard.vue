<template>
  <div class="video-card">
    <div class="video-cover" @click="goToDetail">
      <img v-if="video.coverUrl" :src="video.coverUrl" :alt="video.name" />
      <div v-else class="no-cover">暂无封面</div>
      <span v-if="video.quality" class="quality-badge">{{ video.quality }}</span>
    </div>
    <div class="video-body" @click="goToDetail">
      <div class="row1">
        <span class="name">{{ video.name }}</span>
        <span v-if="video.country" class="type-tag">{{ video.country }}</span>
      </div>
      <div class="row2">
        <span v-if="video.code" class="code">{{ video.code }}</span>
        <span v-if="video.actors && video.actors.length > 0" class="actors">
          {{ video.actors.map(a => a.name).join(', ') }}
        </span>
      </div>
    </div>
    <div v-if="showActions" class="card-actions">
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
}

.row1 {
  display: flex;
  justify-content: space-between;
  align-items: center;
  overflow: hidden;
}

.name {
  font-size: 14px;
  font-weight: bold;
  color: #333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  margin-right: 8px;
}

.type-tag {
  font-size: 12px;
  color: #666;
  background: #f5f5f5;
  padding: 2px 8px;
  border-radius: 10px;
  white-space: nowrap;
  flex-shrink: 0;
}

.row2 {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #999;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.code {
  flex-shrink: 0;
  color: #999;
}

.actors {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #999;
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
