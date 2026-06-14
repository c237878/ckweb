<template>
  <div class="video-list">
    <div class="list-header">
      <h1>影片列表</h1>
      <div class="header-actions">
        <label class="select-all">
          <input type="checkbox" :checked="isAllSelected" @change="toggleSelectAll" />
          全选
        </label>
        <button v-if="selectedVideos.length > 0" class="batch-delete-btn" @click="batchDelete">
          批量删除 ({{ selectedVideos.length }})
        </button>
        <button class="add-btn" @click="showAddDialog = true">添加影片</button>
      </div>
    </div>
    <div class="filters">
      <select v-model="filters.category" @change="loadVideos">
        <option value="">全部分类</option>
        <option value="电影">电影</option>
        <option value="电视剧">电视剧</option>
        <option value="动漫">动漫</option>
        <option value="其他">其他</option>
      </select>
      <select v-model="filters.sambaDir" @change="loadVideos">
        <option value="">全部Samba目录</option>
        <option v-for="samba in sambaList" :key="samba.id" :value="samba.path">{{ samba.name }}</option>
      </select>
    </div>
    <div class="video-grid">
      <VideoCard
        v-for="video in videos"
        :key="video.id"
        :video="video"
        :show-actions="true"
        :selectable="true"
        :selected="selectedVideos.includes(video.id)"
        @edit="handleEditVideo"
        @select="handleSelectVideo"
      />
    </div>
    <div class="pagination" v-if="total > pageSize">
      <button :disabled="page === 1" @click="changePage(page - 1)">上一页</button>
      <span>第 {{ page }} 页 / 共 {{ Math.ceil(total / pageSize) }} 页 ({{ total }} 部)</span>
      <button :disabled="page * pageSize >= total" @click="changePage(page + 1)">下一页</button>
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
import { videoApi, sambaApi } from '@/scripts/api'
import VideoCard from '@/views/components/VideoCard.vue'
import AddVideoDialog from '@/views/components/AddVideoDialog.vue'

const videos = ref([])
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)
const sambaList = ref([])
const filters = ref({
  category: '',
  sambaDir: ''
})
const showAddDialog = ref(false)
const editingVideo = ref(null)
const selectedVideos = ref([])

const isAllSelected = computed(() => {
  return videos.value.length > 0 && selectedVideos.value.length === videos.value.length
})

const toggleSelectAll = () => {
  if (isAllSelected.value) {
    selectedVideos.value = []
  } else {
    selectedVideos.value = videos.value.map(v => v.id)
  }
}

const handleSelectVideo = (videoId) => {
  const index = selectedVideos.value.indexOf(videoId)
  if (index > -1) {
    selectedVideos.value.splice(index, 1)
  } else {
    selectedVideos.value.push(videoId)
  }
}

const batchDelete = async () => {
  if (!confirm(`确定要删除选中的 ${selectedVideos.value.length} 部影片吗？`)) return
  
  try {
    for (const videoId of selectedVideos.value) {
      await videoApi.delete(videoId)
    }
    selectedVideos.value = []
    await loadVideos()
    alert('批量删除成功！')
  } catch (error) {
    console.error('批量删除失败:', error)
    alert('批量删除失败：' + error.message)
  }
}

onMounted(async () => {
  await loadSambaList()
  await loadVideos()
})

const loadSambaList = async () => {
  try {
    const res = await sambaApi.getList()
    if (res.success) {
      sambaList.value = res.data || []
    }
  } catch (error) {
    console.error('加载Samba列表失败:', error)
  }
}

const loadVideos = async () => {
  try {
    const params = {
      page: page.value,
      pageSize: pageSize.value
    }
    if (filters.value.category) params.category = filters.value.category
    if (filters.value.sambaDir) params.sambaDir = filters.value.sambaDir

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
    await loadVideos()
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

.video-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
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
