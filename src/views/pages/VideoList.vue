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
        <button class="rename-check-btn" :disabled="renaming" @click="checkAndRename">
          {{ renaming ? '检查中...' : '校验文件名' }}
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
      <select v-model="filters.mediaAttrFlags" @change="page = 1; loadVideos()">
        <option value="">全部片源</option>
        <option value="0">未设置</option>
        <option value="1">劣质</option>
        <option value="2">无字幕</option>
        <option value="3">完美</option>
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
      <button class="reset-btn" @click="handleReset">重置</button>
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
      <input class="goto-input" v-model.number="gotoPage" type="number" min="1" :max="Math.ceil(total / pageSize)"
        placeholder="跳转" @keyup.enter="handleGotoPage" />
      <button @click="handleGotoPage">跳转</button>
      <button :disabled="page * pageSize >= total" @click="changePage(page + 1)">下一页</button>
    </div>

    <AddVideoDialog
      :visible="showAddDialog"
      :editing-video="editingVideo"
      @save="handleSaveVideo"
      @save-continue="handleSaveContinue"
      @cancel="showAddDialog = false; editingVideo = null"
      @delete="handleDeleteVideo"
    />

    <!-- 删除确认弹窗 -->
    <div v-if="deleteConfirmVisible" class="delete-confirm-overlay" @click="handleDeleteChoice('cancel')">
      <div class="delete-confirm-dialog" @click.stop>
        <h3>确认删除</h3>
        <p>确定要删除这部影片吗？</p>
        <div class="delete-confirm-actions">
          <button class="delete-cancel-btn" @click="handleDeleteChoice('cancel')">取消</button>
          <button class="delete-record-btn" @click="handleDeleteChoice('deleteRecordOnly')">仅删记录</button>
          <button class="delete-all-btn" @click="handleDeleteChoice('deleteAll')">删除记录和文件</button>
        </div>
      </div>
    </div>
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
  downloaded: '',
  mediaAttrFlags: ''
})
const showAddDialog = ref(false)
const renaming = ref(false)

const checkAndRename = async () => {
    if (renaming.value) return
    if (!confirm('将检查所有影片的视频文件名和封面文件名是否与番号一致，不一致的自动重命名。是否继续？')) return
    renaming.value = true
    try {
        const res = await videoApi.renameToCode()
        if (res.success) {
            const d = res.data
            const lines = d.details.slice(0, 20).map(item => {
                if (item.errors?.length > 0) {
                    return `⚠️ ${item.code}：${item.errors.join('；')}`
                }
                const parts = []
                if (item.fileRenamed) parts.push(`视频 ${item.oldFile.split('/').pop()}→${item.newFile.split('/').pop()}`)
                if (item.coverRenamed) parts.push(`封面 ${item.oldCover.split('/').pop()}→${item.newCover.split('/').pop()}`)
                return `✅ ${item.code}：${parts.join('，')}`
            })
            const more = d.details.length > 20 ? `\n...还有 ${d.details.length - 20} 条` : ''
            alert(`检查完成：重命名 ${d.renamed} 条，跳过 ${d.skipped} 条，失败 ${d.failed} 条\n\n${lines.join('\n')}${more}`)
            await loadVideos()
        } else {
            alert('检查失败: ' + (res.message || '未知错误'))
        }
    } catch (error) {
        console.error('校验文件名失败:', error)
        alert('检查失败: ' + error.message)
    }
    renaming.value = false
}
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
  const choice = await showDeleteConfirm()
  if (choice === 'cancel') return
  try {
    await videoApi.batchDelete(selectedIds.value, { deleteFiles: choice === 'deleteAll' })
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
    if (saved.filters) {
      const { keyword, ...rest } = saved.filters
      filters.value = { ...filters.value, ...rest }
    }
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
    if (filters.value.mediaAttrFlags !== '') params.mediaAttrFlags = parseInt(filters.value.mediaAttrFlags)
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
  saveFilterState(STORAGE_KEY, { filters: filters.value, page: page.value, seriesInput: seriesInput.value })
  loadVideos()
}

// 重置筛选
const handleReset = () => {
  filters.value = { country: '', category: '', seriesId: '', keyword: '', downloaded: '', mediaAttrFlags: '', sortBy: '' }
  seriesInput.value = ''
  page.value = 1
  saveFilterState(STORAGE_KEY, { filters: filters.value, page: 1, seriesInput: '' })
  loadVideos()
}

const gotoPage = ref()
const handleGotoPage = () => {
    const totalPages = Math.ceil(total.value / pageSize.value)
    const p = gotoPage.value
    if (!p || p < 1 || p > totalPages) return
    changePage(p)
    gotoPage.value = undefined
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

const handleSaveContinue = async (formData) => {
  try {
    await videoApi.add(formData)
    await Promise.all([loadVideos(), loadMeta()])
    // 不关闭弹窗，由子组件已清空相关字段
  } catch (error) {
    console.error('保存失败:', error)
    alert('保存失败: ' + (error.message || '未知错误'))
  }
}

const handleDeleteVideo = async (videoId) => {
  // 二次确认，让用户选择是否删除文件
  const choice = await showDeleteConfirm(videoId)
  if (choice === 'cancel') return
  
  try {
    await videoApi.delete(videoId, { deleteFiles: choice === 'deleteAll' })
    showAddDialog.value = false
    editingVideo.value = null
    await loadVideos()
  } catch (error) {
    console.error('删除失败:', error)
    alert('删除失败：' + error.message)
  }
}

// 自定义删除确认弹窗
const deleteConfirmVisible = ref(false)
const deleteConfirmResolve = ref(null)
const showDeleteConfirm = (videoId) => {
  return new Promise((resolve) => {
    deleteConfirmResolve.value = resolve
    deleteConfirmVisible.value = true
  })
}
const handleDeleteChoice = (choice) => {
  deleteConfirmVisible.value = false
  if (deleteConfirmResolve.value) {
    deleteConfirmResolve.value(choice)
    deleteConfirmResolve.value = null
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

.rename-check-btn {
  padding: 10px 20px;
  background: #8e44ad;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: background 0.2s;
}

.rename-check-btn:hover:not(:disabled) {
  background: #7d3c98;
}

.rename-check-btn:disabled {
  background: #95a5a6;
  cursor: not-allowed;
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
.reset-btn {
  padding: 8px 16px;
  background: #e74c3c;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  white-space: nowrap;
}

.reset-btn:hover {
  background: #c0392b;
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

.goto-input {
  width: 60px;
  padding: 10px 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 13px;
  text-align: center;
}

.goto-input:focus {
  outline: none;
  border-color: #3498db;
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
.delete-confirm-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999;
}

.delete-confirm-dialog {
  background: #fff;
  border-radius: 8px;
  padding: 24px;
  max-width: 400px;
  width: 90%;
}

.delete-confirm-dialog h3 {
  margin: 0 0 12px;
  font-size: 18px;
}

.delete-confirm-dialog p {
  margin: 0 0 20px;
  color: #666;
}

.delete-confirm-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.delete-cancel-btn {
  padding: 8px 16px;
  background: #f0f0f0;
  color: #333;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.delete-cancel-btn:hover {
  background: #e0e0e0;
}

.delete-record-btn {
  padding: 8px 16px;
  background: #f39c12;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.delete-record-btn:hover {
  background: #d68910;
}

.delete-all-btn {
  padding: 8px 16px;
  background: #e74c3c;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.delete-all-btn:hover {
  background: #c0392b;
}

</style>
