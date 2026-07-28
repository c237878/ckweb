<template>
  <div class="detail-page" v-if="series">
    <div class="detail-header">
      <div class="header-row">
        <h1>{{ series.name }}</h1>
        <span v-if="series.country" class="country-tag">{{ series.country }}</span>
        <span v-if="series.likeCount > 0" class="like-tag">♥ {{ series.likeCount }}</span>
        <button class="edit-btn" @click="openEditDialog">编辑</button>
        <template v-if="videos.length > 1">
          <button v-if="!sorting" class="sort-btn" @click="startSort">编辑排序</button>
          <button v-else class="sort-btn save" @click="saveSort" :disabled="savingSort">
            {{ savingSort ? '保存中...' : '完成排序' }}
          </button>
          <button v-if="sorting" class="sort-btn cancel" @click="cancelSort">取消</button>
        </template>
      </div>
      <p v-if="series.alias" class="alias-row">别名：{{ series.alias }}</p>
      <p v-if="series.link" class="link-row">
        链接：<a :href="series.link" target="_blank">{{ decodeUrl(series.link) }}</a>
      </p>
    </div>
    <div v-if="sorting" class="sort-hint">
      📌 拖动影片卡片调整顺序，完成后点击「完成排序」保存
    </div>
    <div class="detail-videos">
      <h2>系列影片 ({{ videos.length }})</h2>
      <div
        class="video-grid"
        :class="{ 'sorting-mode': sorting }"
      >
        <div
          v-for="(video, index) in videos"
          :key="video.id"
          class="video-card-wrapper"
          :class="{
            dragging: dragIndex === index,
            'drag-over': dragOverIndex === index
          }"
          :draggable="sorting"
          @dragstart="onDragStart($event, index)"
          @dragover.prevent="onDragOver($event, index)"
          @dragleave="onDragLeave(index)"
          @drop="onDrop($event, index)"
          @dragend="onDragEnd"
        >
          <div v-if="sorting" class="sort-badge">{{ index + 1 }}</div>
          <VideoCard :video="video" mode="display" />
        </div>
        <div v-if="videos.length === 0" class="empty-hint">暂无影片</div>
      </div>
    </div>

    <AddSeriesDialog
      :visible="showEditDialog"
      :editingSeries="series"
      @save="onEditSave"
      @cancel="showEditDialog = false"
      @delete="onDelete"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { seriesApi } from '@/scripts/api'
import VideoCard from '@/views/components/VideoCard.vue'
import AddSeriesDialog from '@/views/components/AddSeriesDialog.vue'

const route = useRoute()
const series = ref(null)
const videos = ref([])
const showEditDialog = ref(false)

// 排序相关
const sorting = ref(false)
const savedVideos = ref([])  // 排序前的备份
const dragIndex = ref(null)
const dragOverIndex = ref(null)
const savingSort = ref(false)

const openEditDialog = () => {
  showEditDialog.value = true
}

const onEditSave = async (formData) => {
  try {
    await seriesApi.update(series.value.id, formData)
    showEditDialog.value = false
    await loadSeries()
  } catch (error) {
    alert('保存失败：' + (error.message || error))
  }
}

const onDelete = async (id) => {
  if (!confirm('确定要删除该系列吗？')) return
  try {
    await seriesApi.delete(id)
    showEditDialog.value = false
    window.location.href = '/series'
  } catch (error) {
    alert('删除失败：' + (error.message || error))
  }
}

const loadSeries = async () => {
  try {
    const res = await seriesApi.getDetail(route.params.id)
    if (res.success) {
      series.value = res.data
    }
  } catch (error) {
    console.error('加载系列详情失败:', error)
  }
}

const loadVideos = async () => {
  try {
    const res = await seriesApi.getVideos(route.params.id, { page: 1, pageSize: 1000 })
    if (res.success) {
      videos.value = res.data || []
    }
  } catch (error) {
    console.error('加载系列影片失败:', error)
  }
}

const loadAll = async () => {
  await loadSeries()
  await loadVideos()
}

// === 排序相关 ===
const startSort = () => {
  savedVideos.value = JSON.parse(JSON.stringify(videos.value))
  sorting.value = true
}

const cancelSort = () => {
  videos.value = savedVideos.value
  sorting.value = false
  dragIndex.value = null
  dragOverIndex.value = null
}

const saveSort = async () => {
  if (savingSort.value) return
  savingSort.value = true
  try {
    const videoIds = videos.value.map(v => v.id)
    const res = await seriesApi.updateSort(route.params.id, { videoIds })
    if (res.success) {
      sorting.value = false
      savedVideos.value = []
      // 重新加载以获取服务端最新排序
      await loadVideos()
    } else {
      alert('保存排序失败: ' + (res.message || '未知错误'))
    }
  } catch (error) {
    alert('保存排序失败: ' + (error.message || error))
  } finally {
    savingSort.value = false
  }
}

const onDragStart = (e, index) => {
  dragIndex.value = index
  e.dataTransfer.effectAllowed = 'move'
  // Firefox 需要 setData
  e.dataTransfer.setData('text/plain', String(index))
}

const onDragOver = (e, index) => {
  e.dataTransfer.dropEffect = 'move'
  if (dragIndex.value !== null && dragIndex.value !== index) {
    dragOverIndex.value = index
  }
}

const onDragLeave = (index) => {
  if (dragOverIndex.value === index) {
    dragOverIndex.value = null
  }
}

const onDrop = (e, index) => {
  e.preventDefault()
  if (dragIndex.value === null || dragIndex.value === index) {
    onDragEnd()
    return
  }
  // 移动数组元素
  const moved = videos.value.splice(dragIndex.value, 1)[0]
  videos.value.splice(index, 0, moved)
  dragIndex.value = null
  dragOverIndex.value = null
}

const onDragEnd = () => {
  dragIndex.value = null
  dragOverIndex.value = null
}

onMounted(() => {
  loadAll()
})

watch(
  () => route.params.id,
  (newId) => {
    if (newId) {
      loadAll()
    }
  }
)

const decodeUrl = (url) => {
  try {
    return decodeURIComponent(url)
  } catch {
    return url
  }
}
</script>

<style scoped>
.detail-page {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.detail-header {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.header-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.header-row h1 {
  font-size: 32px;
  margin: 0;
}

.edit-btn,
.sort-btn {
  background: none;
  border: 1px solid #ccc;
  border-radius: 4px;
  padding: 4px 12px;
  font-size: 13px;
  color: #666;
  cursor: pointer;
  transition: all 0.2s;
}

.edit-btn:hover {
  border-color: #3498db;
  color: #3498db;
}

.sort-btn:hover {
  border-color: #e67e22;
  color: #e67e22;
}

.sort-btn.save {
  border-color: #27ae60;
  color: #27ae60;
  font-weight: 600;
}

.sort-btn.save:hover {
  background: #27ae60;
  color: #fff;
}

.sort-btn.save:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.sort-btn.cancel {
  border-color: #e74c3c;
  color: #e74c3c;
}

.sort-btn.cancel:hover {
  background: #e74c3c;
  color: #fff;
}

.country-tag {
  background: #f3e5f5;
  color: #7b1fa2;
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 13px;
}

.like-tag {
  background: #fce4ec;
  color: #e74c3c;
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 13px;
}

.alias-row {
  color: #666;
  font-size: 15px;
}

.link-row a {
  color: #3498db;
  font-size: 15px;
  word-break: break-all;
}

.sort-hint {
  background: #fff3cd;
  border: 1px solid #ffc107;
  color: #856404;
  padding: 10px 16px;
  border-radius: 6px;
  font-size: 14px;
}

.detail-videos h2 {
  margin-bottom: 20px;
}

.video-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 20px;
}

.video-grid.sorting-mode .video-card-wrapper {
  cursor: grab;
  position: relative;
  border-radius: 8px;
  transition: transform 0.15s, box-shadow 0.15s;
}

.video-grid.sorting-mode .video-card-wrapper:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.video-grid.sorting-mode .video-card-wrapper.dragging {
  opacity: 0.4;
  cursor: grabbing;
}

.video-grid.sorting-mode .video-card-wrapper.drag-over {
  border: 2px dashed #e67e22;
  background: rgba(230, 126, 34, 0.08);
}

.sort-badge {
  position: absolute;
  top: -8px;
  left: -8px;
  width: 28px;
  height: 28px;
  background: #e67e22;
  color: #fff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
  z-index: 10;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
}

.empty-hint {
  color: #999;
  font-size: 14px;
  padding: 20px;
}
</style>
