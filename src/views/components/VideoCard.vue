<template>
  <div class="video-card">
    <div class="video-cover" @click="goToDetail">
      <img v-if="video.coverUrl" :src="video.coverUrl" :alt="video.name" />
      <div v-else class="no-cover">暂无封面</div>
      <span v-if="video.quality" class="quality-badge">{{ video.quality }}</span>
    </div>
    <div class="video-info" @click="goToDetail">
      <div class="info-row1">
        <span v-if="video.code" class="video-code">{{ video.code }}</span>
        <span class="video-name">{{ video.name }}</span>
      </div>
      <div class="info-row2">
        <span v-if="video.country" class="video-country">{{ video.country }}</span>
        <span v-if="video.actors && video.actors.length > 0" class="video-actors">
          {{ video.actors.map(a => a.name).join(', ') }}
        </span>
      </div>
    </div>
    <div v-if="showActions" class="video-actions">
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
  padding-top: 67.25%; /* 538/800 = 67.25% */
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
}

.quality-badge {
  position: absolute;
  top: 10px;
  right: 10px;
  background: #e74c3c;
  color: white;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
}

.video-info {
  padding: 12px 15px;
  flex: 1;
}

.info-row1 {
  font-weight: bold;
  margin-bottom: 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.video-code {
  color: #e74c3c;
  margin-right: 8px;
  font-size: 13px;
}

.video-name {
  font-size: 14px;
}

.info-row2 {
  font-size: 12px;
  color: #666;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.video-country {
  margin-right: 8px;
  color: #3498db;
}

.video-actors {
  color: #95a5a6;
}

.video-actions {
  padding: 8px 15px;
  display: flex;
  justify-content: flex-end;
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
