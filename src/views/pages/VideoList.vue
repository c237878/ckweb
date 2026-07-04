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
      <select v-model="filters.country" @change="page = 1; loadVideos()">
        <option value="">全部地区</option>
        <option v-for="c in countries" :key="c" :value="c">{{ c }}</option>
      </select>
      <select v-model="filters.category" @change="page = 1; loadVideos()">
        <option value="">全部分类</option>
        <option v-for="cat in categories" :key="cat" :value="cat">{{ cat }}</option>
      </select>
      <select v-model="filters.downloaded" @change="page = 1; loadVideos()">
        <option value="">全部状态</option>
        <option value="yes">已下载</option>
        <option value="no">未下载</option>
      </select>
      <div class="combobox-wrap">
        <input
          v-model="seriesInput"
          type="text"
          placeholder="筛选系列..."
          @focus="showSeriesDropdown = true"
          @blur="hideSeriesDropdown"
        />
        <div v-if="showSeriesDropdown" class="combobox-dropdown">
          <div
            class="combobox-option"
            :class="{ active: filters.seriesId === '' }"
            @mousedown.prevent="selectSeries('')"
          >
            全部系列
          </div>
          <div
            v-for="s in filteredSeriesList"
            :key="s.id"
            class="combobox-option"
            :class="{ active: filters.seriesId === s.id }"
            @mousedown.prevent="selectSeries(s.id, s.name)"
          >
            {{ s.name }}
          </div>
          <div v-if="filteredSeriesList.length === 0" class="combobox-empty">无匹配系列</div>
        </div>
      </div>
      <input
        v-model="filters.keyword"
        type="text"
        placeholder="搜索影片名称或番号..."
        @keyup.enter="handleSearch"
      />
      <button class="search-btn" @click="handleSearch">搜索</button>
      <select v-model="filters.sortBy" @change="page = 1; loadVideos()" class="sort-select">
        <option value="">默认排序</option>
        <option value="code">按番号</option>
        <option value="name">按名称</option>
        <option value="likeCount">按点赞</option>
      </select>
    </div>

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

    <div class="pagination" v-if="total > 0">
      <button :disabled="page === 1" @click="changePage(page - 1)">上一页</button>
      <span>第 {{ page }} 页 / 共 {{ Math.ceil(total / pageSize) }} 页（共 {{ total }} 条）</span>
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
import { ref, onMounted, computed, watch } from 'vue'
import { videoApi, settingApi } from '@/scripts/api'
import VideoCard from '@/views/components/VideoCard.vue'
import AddVideoDialog from '@/views/components/AddVideoDialog.vue'
import { loadFilterState, saveFilterState } from '@/scripts/utils/filterPersist'

const STORAGE_KEY = 'video-list'

const videos = ref([])
const page = ref(1)
const pageSize = ref(24)
const total = ref(0)
const categories = ref([])
const countries = ref([])
const seriesList = ref([])
const filters = ref({
  sortBy: '',
  category: '',
  country: '',
  seriesId: '',
  keyword: '',
  downloaded: ''
})
const showAddDialog = ref(false)
const editingVideo = ref(null)
const selectedIds = ref([])
const showSeriesDropdown = ref(false)
const seriesInput = ref('')

// 持久化
watch(filters, () => saveFilterState(STORAGE_KEY, { filters: filters.value, page: page.value, seriesInput: seriesInput.value }), { deep: true })

const isAllSelected = computed(() => {
  return videos.value.length > 0 && selectedIds.value.length === videos.value.length
})

const filteredSeriesList = computed(() => {
  const list = seriesList.value || []
  if (!seriesInput.value) return list.slice(0, 50)
  return list.filter(s => s.name.toLowerCase().includes(seriesInput.value.toLowerCase())).slice(0, 50)
})

const toggleSelectAll = () => {
  if (isAllSelected.value) {
    selectedIds.value = []
  } else {
    selectedIds.value = videos.value.map(v => v.id)
  }
}

const selectSeries = (seriesId, seriesName = '') => {
  filters.value.seriesId = seriesId
  seriesInput.value = seriesId ? seriesName : ''
  showSeriesDropdown.value = false
  page.value = 1
  loadVideos()
}

const hideSeriesDropdown = () => {
  setTimeout(() => {
    showSeriesDropdown.value = false
  }, 200)
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
  } catch (error) {
    console.error('批量删除失败:', error)
    alert('批量删除失败：' + error.message)
  }
}

onMounted(async () => {
  // 恢复筛选状态
  const saved = loadFilterState(STORAGE_KEY)
  if (saved) {
    if (saved.filters) filters.value = { ...filters.value, ...saved.filters }
    if (saved.page) page.value = saved.page
    if (saved.seriesInput !== undefined) seriesInput.value = saved.seriesInput || ''
  }

  try {
    const res = await settingApi.getByName('pageSize')
    if (res.success && res.data) {
      pageSize.value = Number(res.data) || 24
    }
  } catch (e) {
    console.warn('读取 pageSize 设置失败，使用默认值 24')
  }
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
      pageIndex: page.value,
      pageSize: pageSize.value
    }
    if (filters.value.category) params.category = filters.value.category
    if (filters.value.country) params.country = filters.value.country
    if (filters.value.seriesId) params.seriesId = filters.value.seriesId
    if (filters.value.keyword) params.keyword = filters.value.keyword
    if (filters.value.downloaded === 'yes') params.hasFile = true
    else if (filters.value.downloaded === 'no') params.hasFile = false
    if (filters.value.sortBy) params.sortBy = filters.value.sortBy

    const res = await videoApi.getList(params)
    if (res.success) {
      videos.value = res.data.list || []
      total.value = res.data.total || 0
    }
  } catch (error) {
    console.error('加载影片失败:', error)
  }
}

const handleSearch = () => {
  page.value = 1
  loadVideos()
}

const changePage = (newPage) => {
  if (newPage < 1) return
  page.value = newPage
  saveFilterState(STORAGE_KEY, { filters: filters.value, page: page.value, seriesInput: seriesInput.value })
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
  display: flex;
  flex-direction: column;
  gap: 20px;
  max-width: 1400px;
  margin: 0 auto;
}

.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.list-header h1 {
  font-size: 28px;
  color: #333;
  margin: 0;
}

.add-btn {
  padding: 10px 20px;
  background: #3498db;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: background 0.2s;
}

.add-btn:hover {
  background: #2980b9;
}

.filters {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  align-items: center;
}

.sort-select {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  height: 38px;
  box-sizing: border-box;
  background: #fff;
  cursor: pointer;
}

.filters select,
.filters input[type="text"] {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  height: 38px;
  box-sizing: border-box;
}

.filters input[type="text"] {
  min-width: 200px;
}

.combobox-wrap {
  position: relative;
  min-width: 200px;
}

.combobox-wrap input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  height: 38px;
  box-sizing: border-box;
}

.combobox-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: #fff;
  border: 1px solid #ddd;
  border-radius: 6px;
  margin-top: 4px;
  max-height: 300px;
  overflow-y: auto;
  z-index: 100;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.combobox-option {
  padding: 8px 12px;
  cursor: pointer;
  font-size: 14px;
}

.combobox-option:hover {
  background: #f5f5f5;
}

.combobox-option.active {
  background: #e3f2fd;
  color: #1976d2;
}

.combobox-empty {
  padding: 8px 12px;
  color: #999;
  font-size: 14px;
}

.search-btn {
  padding: 8px 16px;
  background: #3498db;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  height: 38px;
  box-sizing: border-box;
  transition: background 0.2s;
}
.search-btn:hover {
  background: #2980b9;
}

.video-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

@media (max-width: 768px) {
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
