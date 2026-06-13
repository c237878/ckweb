<template>
  <div class="video-list">
    <div class="list-header">
      <h1>影片列表</h1>
      <button class="add-btn" @click="showAddDialog = true">添加影片</button>
    </div>
    <div class="filters">
      <select v-model="filters.seriesId" @change="loadVideos">
        <option value="">全部系列</option>
        <option v-for="series in seriesList" :key="series.id" :value="series.id">
          {{ series.name }}
        </option>
      </select>
      <select v-model="filters.country" @change="loadVideos">
        <option value="">全部类型</option>
        <option v-for="country in existingCountries" :key="country" :value="country">
          {{ country }}
        </option>
      </select>
    </div>
    <div class="video-grid">
      <VideoCard
        v-for="video in videos"
        :key="video.id"
        :video="video"
        :show-actions="true"
        @edit="handleEditVideo"
      />
    </div>
    <div class="pagination" v-if="total > pageSize">
      <button :disabled="page === 1" @click="changePage(page - 1)">上一页</button>
      <span>第 {{ page }} 页</span>
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
import { ref, onMounted } from 'vue'
import { videoApi, seriesApi, videoActorApi } from '@/scripts/api'
import VideoCard from '@/views/components/VideoCard.vue'
import AddVideoDialog from '@/views/components/AddVideoDialog.vue'

const videos = ref([])
const seriesList = ref([])
const existingCountries = ref([])
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)
const filters = ref({
  seriesId: '',
  country: ''
})
const showAddDialog = ref(false)
const editingVideo = ref(null)

onMounted(async () => {
  await Promise.all([
    loadSeries(),
    loadExistingCountries(),
    loadVideos()
  ])
})

const loadSeries = async () => {
  try {
    const res = await seriesApi.getList({ page: 1, pageSize: 100 })
    if (res.success) {
      seriesList.value = res.data
    }
  } catch (error) {
    console.error('加载系列失败:', error)
  }
}

const loadExistingCountries = async () => {
  try {
    const res = await videoApi.getList({ pageIndex: 1, pageSize: 1000 })
    if (res.success && res.data) {
      const list = Array.isArray(res.data) ? res.data : res.data.list
      const countries = new Set()
      list.forEach(video => {
        if (video.country) countries.add(video.country)
      })
      existingCountries.value = Array.from(countries)
    }
  } catch (error) {
    console.error('加载类型列表失败:', error)
  }
}

const loadVideos = async () => {
  try {
    const params = {
      pageIndex: page.value,
      pageSize: pageSize.value
    }
    if (filters.value.seriesId) params.seriesId = filters.value.seriesId
    if (filters.value.country) params.country = filters.value.country

    const res = await videoApi.getList(params)
    if (res.success) {
      videos.value = Array.isArray(res.data) ? res.data : res.data.list
      total.value = Array.isArray(res.data) ? res.data.length : res.data.total
    }
  } catch (error) {
    console.error('加载影片失败:', error)
  }
}

const changePage = (newPage) => {
  page.value = newPage
  loadVideos()
}

const handleEditVideo = (video) => {
  editingVideo.value = video
  showAddDialog.value = true
}

const handleDeleteVideo = async (videoId) => {
  try {
    const res = await videoApi.delete(videoId)
    if (res.success) {
      showAddDialog.value = false
      editingVideo.value = null
      alert('删除成功！')
      await loadVideos()
    } else {
      alert('删除失败：' + res.message)
    }
  } catch (error) {
    console.error('删除影片失败:', error)
    alert('删除失败：' + error.message)
  }
}

const handleSaveVideo = async (videoData) => {
  try {
    let res
    let videoId

    if (editingVideo.value) {
      res = await videoApi.update(editingVideo.value.id, videoData)
      videoId = editingVideo.value.id
    } else {
      res = await videoApi.add(videoData)
      videoId = res.data.id
    }

    if (res.success) {
      if (videoData.actorIds && videoData.actorIds.length > 0) {
        await videoActorApi.setVideoActors(videoId, videoData.actorIds)
      }

      showAddDialog.value = false
      editingVideo.value = null
      await loadVideos()
      await loadExistingCountries()
      alert(editingVideo.value ? '更新成功！' : '添加成功！')
    } else {
      alert('操作失败：' + res.message)
    }
  } catch (error) {
    console.error('保存影片失败:', error)
    alert('操作失败：' + error.message)
  }
}
</script>

<style scoped>
.video-list {
  padding: 20px 0;
}

.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

h1 {
  margin: 0;
  font-size: 22px;
  color: #333;
}

.add-btn {
  padding: 8px 20px;
  background: #e74c3c;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: background 0.3s;
}

.add-btn:hover {
  background: #c0392b;
}

.filters {
  margin-bottom: 20px;
  display: flex;
  gap: 12px;
}

.filters select {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  color: #333;
}

.video-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px;
  margin-bottom: 30px;
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 20px;
}

.pagination button {
  padding: 8px 16px;
  background: #e74c3c;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.pagination button:disabled {
  background: #ccc;
  cursor: not-allowed;
}
</style>
