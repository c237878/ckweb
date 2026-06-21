<template>
  <div class="video-list">
    <div class="list-header">
      <h1>影片列表</h1>
      <div class="header-actions">
        <label class="select-all">
          <input type="checkbox" :checked="isAllSelected" @change="toggleSelectAll" />
          全选
        </label>
        <button v-if="selectedIds.length > 0" class="batch-delete-btn" @click="batchDelete">
          批量删除 ({{ selectedIds.length }})
        </button>
        <button class="add-btn" @click="showAddDialog = true">添加影片</button>
      </div>
    </div>
    <div class="filters">
      <div class="filter-item">
        <select v-model="filters.category" @change="loadVideos">
          <option value="">全部分类</option>
          <option v-for="cat in categories" :key="cat" :value="cat">{{ cat }}</option>
        </select>
      </div>
      <div class="filter-item">
        <select v-model="filters.country" @change="loadVideos">
          <option value="">全部地区</option>
          <option v-for="c in countries" :key="c" :value="c">{{ c }}</option>
        </select>
      </div>
    </div>
    <div class="content-with-sidebar">
      <div class="main-area">
        <div class="video-grid">
          <VideoCard
            v-for="video in videos"
            :key="video.id"
            :video="video"
            :show-actions="true"
            :selectable="true"
            :selected="selectedIds.includes(video.id)"
            @edit="handleEditVideo"
            @select="handleSelectVideo"
          />
        </div>
        <div class="pagination" v-if="total > pageSize">
          <button :disabled="page === 1" @click="changePage(page - 1)">上一页</button>
          <span>第 {{ page }} 页 / 共 {{ Math.ceil(total / pageSize) }} 页 ({{ total }} 部)</span>
          <button :disabled="page * pageSize >= total" @click="changePage(page + 1)">下一页</button>
        </div>
      </div>

      <div class="series-sidebar">
        <div class="sidebar-title">影视系列</div>
        <div
          class="sidebar-item"
          :class="{ active: filters.seriesId === '' }"
          @click="filters.seriesId = ''; loadVideos()"
        >全部系列</div>
        <div
          v-for="s in seriesList"
          :key="s.id"
          class="sidebar-item"
          :class="{ active: filters.seriesId === s.id }"
          @click="filters.seriesId = s.id; loadVideos()"
        >{{ s.name }}</div>
      </div>
    </div>

    <AddVideoDialog
      :visible="showAddDialog"
      :editing-video="editingVideo"
      @save="handleSaveVideo"
      @cancel="showAddDialog = false; editingVideo = null"
      @delete="handleDeleteVideo"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { videoApi } from '@/scripts/api'
import VideoCard from '@/views/components/VideoCard.vue'
import AddVideoDialog from '@/views/components/AddVideoDialog.vue'

const videos = ref([])
const page = ref(1)
const pageSize = ref(24)
const total = ref(0)
const categories = ref([])
const countries = ref([])
const seriesList = ref([])
const filters = ref({
  category: '',
  country: '',
  seriesId: ''
})
const showAddDialog = ref(false)
const editingVideo = ref(null)
const selectedIds = ref([])

const isAllSelected = computed(() => {
  return videos.value.length > 0 && selectedIds.value.length === videos.value.length
})

const toggleSelectAll = () => {
  if (isAllSelected.value) {
    selectedIds.value = []
  } else {
    selectedIds.value = videos.value.map(v => v.id)
  }
}

const handleSelectVideo = (videoId) => {
  const index = selectedIds.value.indexOf(videoId)
  if (index > -1) {
    selectedIds.value.splice(index, 1)
  } else {
    selectedIds.value.push(videoId)
  }
}

const batchDelete = async () => {
  if (!confirm(`确定要删除选中的 ${selectedIds.value.length} 部影片吗？`)) return
  try {
    await videoApi.batchDelete(selectedIds.value)
    selectedIds.value = []
    await loadVideos()
    alert('批量删除成功！')
  } catch (error) {
    console.error('批量删除失败:', error)
    alert('批量删除失败：' + error.message)
  }
}

onMounted(async () => {
  await Promise.all([loadMeta(), loadVideos()])
})

const loadMeta = async () => {
  try {
    const res = await videoApi.getMeta()
    if (res.success) {
      categories.value = res.categories || []
      countries.value = res.countries || []
      seriesList.value = res.series || []
    }
  } catch (error) {
    console.error('加载元数据失败:', error)
  }
}

const loadVideos = async () => {
  try {
    const params = {
      page: page.value,
      pageSize: pageSize.value
    }
    if (filters.value.category) params.category = filters.value.category
    if (filters.value.country) params.country = filters.value.country
    if (filters.value.seriesId) params.seriesId = filters.value.seriesId

    const res = await videoApi.getList(params)
    if (res.success) {
      videos.value = res.data.list || []
      total.value = res.data.total || 0
    }
  } catch (error) {
    console.error('加载影片失败:', error)
  }
}

const changePage = (newPage) => {
  if (newPage < 1) return
  page.value = newPage
  loadVideos()
}

const handleEditVideo = (video) => {
  editingVideo.value = video
  showAddDialog.value = true
}

const handleSaveVideo = async (formData) => {
  try {
    if (formData.id) {
      await videoApi.update(formData.id, formData)
    } else {
      await videoApi.add(formData)
    }
    showAddDialog.value = false
    editingVideo.value = null
    await Promise.all([loadVideos(), loadMeta()])
  } catch (error) {
    console.error('保存失败:', error)
  }
}

const handleDeleteVideo = async (videoId) => {
  if (!confirm('确定要删除这部影片吗？')) return
  try {
    await videoApi.delete(videoId)
    showAddDialog.value = false
    editingVideo.value = null
    await loadVideos()
  } catch (error) {
    console.error('删除失败:', error)
  }
}
</script>

<style scoped>
.video-list {
  padding: 20px;
  max-width: 1400px;
  margin: 0 auto;
}

.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.list-header h1 {
  font-size: 28px;
  color: #333;
  margin: 0;
}

.add-btn {
  padding: 10px 20px;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
}

.add-btn:hover {
  background: #0056b3;
}

.filters {
  margin-bottom: 20px;
  display: flex;
  gap: 10px;
}

.filters select {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  min-width: 150px;
}

.content-with-sidebar {
  display: flex;
  gap: 20px;
  align-items: flex-start;
}

.main-area {
  flex: 1;
  min-width: 0;
}

.video-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 16px;
  margin-bottom: 30px;
}

.series-sidebar {
  width: 180px;
  flex-shrink: 0;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  padding: 12px 0;
  position: sticky;
  top: 20px;
  max-height: calc(100vh - 120px);
  overflow-y: auto;
}

.sidebar-title {
  font-size: 14px;
  font-weight: bold;
  color: #333;
  padding: 4px 16px 8px;
  border-bottom: 1px solid #f0f0f0;
  margin-bottom: 4px;
}

.sidebar-item {
  padding: 8px 16px;
  font-size: 13px;
  color: #666;
  cursor: pointer;
  border-radius: 4px;
  transition: background 0.2s;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sidebar-item:hover {
  background: #f5f5f5;
}

.sidebar-item.active {
  color: #3498db;
  font-weight: bold;
}

@media (max-width: 1200px) {
  .video-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}

@media (max-width: 768px) {
  .content-with-sidebar {
    flex-direction: column;
  }
  .series-sidebar {
    width: 100%;
    position: static;
    max-height: none;
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    padding: 8px;
  }
  .sidebar-title {
    width: 100%;
    padding: 0 0 4px;
    border-bottom: none;
    margin-bottom: 0;
  }
  .sidebar-item {
    padding: 4px 10px;
    background: #f5f5f5;
    border-radius: 4px;
    font-size: 12px;
  }
  .video-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .list-header {
    flex-direction: column;
    gap: 12px;
    align-items: flex-start;
  }
  .header-actions {
    width: 100%;
    justify-content: flex-end;
  }
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 15px;
  margin-top: 30px;
}

.pagination button {
  padding: 8px 16px;
  border: 1px solid #ddd;
  background: white;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
}

.pagination button:hover:not(:disabled) {
  background: #f5f5f5;
}

.pagination button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.pagination span {
  font-size: 14px;
  color: #666;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.select-all {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  font-size: 14px;
  color: #666;
}

.select-all input[type="checkbox"] {
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.batch-delete-btn {
  padding: 8px 16px;
  background: #e74c3c;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
}

.batch-delete-btn:hover {
  background: #c0392b;
}
</style>
