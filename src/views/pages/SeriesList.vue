<template>
  <div class="series-list">
    <div class="list-header">
      <h1>影视系列</h1>
      <div class="header-actions">
        <label class="select-all">
          <input type="checkbox" :checked="isAllSelected" @change="toggleSelectAll" />
          全选
        </label>
        <button v-if="selectedIds.length > 0" class="batch-delete-btn" @click="batchDelete">
          批量删除 ({{ selectedIds.length }})
        </button>
        <button class="add-btn" @click="handleAdd">添加系列</button>
      </div>
    </div>

    <div class="filters">
      <select v-model="filters.country" @change="page = 1; loadSeries()">
        <option value="">全部地区</option>
        <option v-for="c in countries" :key="c" :value="c">{{ c }}</option>
      </select>
      <input
        v-model="keyword"
        placeholder="搜索系列..."
        type="text"
        @keyup.enter="handleSearch"
      />
      <button class="search-btn" @click="handleSearch">搜索</button>
      <select v-model="filters.sortBy" @change="page = 1; loadSeries()" class="sort-select">
        <option value="">默认排序</option>
        <option value="name">按名称</option>
        <option value="likeCount">按点赞</option>
        <option value="videoCount">按作品数</option>
      </select>
    </div>

    <div class="series-grid">
      <div
        class="series-card"
        v-for="series in seriesList"
        :key="series.id"
        :class="{ selected: selectedIds.includes(series.id) }"
      >
        <div class="card-main">
          <div class="card-checkbox-col">
            <input
              type="checkbox"
              class="card-checkbox"
              :checked="selectedIds.includes(series.id)"
              @change="handleSelect(series)"
              @click.stop
            />
          </div>
          <div class="card-body" @click="handleSelect(series)">
            <div class="info-row">
              <span class="name">{{ series.name }}</span>
              <div class="right-tags">
                <span v-if="series.likeCount > 0" class="like-count">♥ {{ series.likeCount }}</span>
                <span v-if="series.videoCount > 0" class="video-count">{{ series.videoCount }} 部</span>
                <span v-if="series.country" class="country-tag">{{ series.country }}</span>
              </div>
            </div>
            <div class="info-row alias-row" v-if="series.alias">
              <span class="alias">{{ series.alias }}</span>
            </div>
          </div>
        </div>
        <CardActions>
          <button v-if="series.link" class="btn" @click.stop="openLink(series.link)">链接</button>
          <button class="btn btn-primary" @click.stop="handleEdit(series)">编辑</button>
          <button class="btn btn-success" @click.stop="goToDetail(series.id)">详情</button>
        </CardActions>
      </div>
    </div>

    <div class="empty-hint" v-if="seriesList.length === 0 && !loading">暂无系列</div>

    <div class="pagination" v-if="total > 0">
      <button :disabled="page === 1" @click="changePage(page - 1)">上一页</button>
      <span>第 {{ page }} 页 / 共 {{ Math.ceil(total / pageSize) }} 页（共 {{ total }} 条）</span>
      <button :disabled="page * pageSize >= total" @click="changePage(page + 1)">下一页</button>
    </div>

    <AddSeriesDialog
      :visible="showDialog"
      :editing-series="editingSeries"
      @save="handleSave"
      @cancel="handleCancel"
      @delete="handleSeriesDelete"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { seriesApi, settingApi } from '@/scripts/api'
import CardActions from '@/views/components/CardActions.vue'
import AddSeriesDialog from '@/views/components/AddSeriesDialog.vue'

const router = useRouter()
const seriesList = ref([])
const page = ref(1)
const pageSize = ref(24)
const total = ref(0)
const keyword = ref('')
const loading = ref(false)
const showDialog = ref(false)
const editingSeries = ref(null)
const countries = ref([])
const filters = ref({ country: '', sortBy: '' })
const selectedIds = ref([])

const isAllSelected = computed(() => {
  return seriesList.value.length > 0 && selectedIds.value.length === seriesList.value.length
})

const toggleSelectAll = () => {
  if (isAllSelected.value) {
    selectedIds.value = []
  } else {
    selectedIds.value = seriesList.value.map(s => s.id)
  }
}

const handleSelect = (series) => {
  const idx = selectedIds.value.indexOf(series.id)
  if (idx > -1) {
    selectedIds.value.splice(idx, 1)
  } else {
    selectedIds.value.push(series.id)
  }
}

const batchDelete = async () => {
  if (!confirm(`确定要删除选中的 ${selectedIds.value.length} 个系列吗？`)) return
  try {
    for (const id of selectedIds.value) {
      await seriesApi.delete(id)
    }
    selectedIds.value = []
    await loadSeries()
  } catch (error) {
    console.error('批量删除失败:', error)
    alert('批量删除失败：' + error.message)
  }
}

const loadSeries = async () => {
  loading.value = true
  try {
    const params = {
      page: page.value,
      pageSize: pageSize.value,
      keyword: keyword.value
    }
    if (filters.value.country) params.country = filters.value.country
    if (filters.value.sortBy) params.sortBy = filters.value.sortBy

    const res = await seriesApi.getList(params)
    if (res.success) {
      seriesList.value = res.data || []
      total.value = res.total || 0
    }
  } catch (error) {
    console.error('加载系列失败:', error)
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  page.value = 1
  loadSeries()
}

const changePage = (p) => {
  page.value = p
  loadSeries()
}

const goToDetail = (id) => {
  router.push(`/series/${id}`)
}

const openLink = (link) => {
  if (link) window.open(link, '_blank')
}

const handleAdd = () => {
  editingSeries.value = null
  showDialog.value = true
}

const handleEdit = (series) => {
  editingSeries.value = series
  showDialog.value = true
}

const handleSave = async (formData) => {
  try {
    if (formData.id) {
      await seriesApi.update(formData.id, formData)
    } else {
      await seriesApi.add(formData)
    }
  } catch (error) {
    alert('保存失败：' + (error.message || error))
    return
  }
  showDialog.value = false
  editingSeries.value = null
  await loadSeries()
}

const handleSeriesDelete = async (id) => {
  if (!confirm('确定要删除该系列吗？')) return
  try {
    await seriesApi.delete(id)
    showDialog.value = false
    editingSeries.value = null
    await loadSeries()
  } catch (error) {
    alert('删除失败：' + (error.message || error))
  }
}

const handleCancel = () => {
  showDialog.value = false
  editingSeries.value = null
}

onMounted(async () => {
  try {
    const res = await settingApi.getByName('pageSize')
    if (res.success && res.data) {
      pageSize.value = Number(res.data) || 24
    }
  } catch (e) {
    console.warn('读取 pageSize 设置失败，使用默认值 24')
  }
  try {
    const metaRes = await seriesApi.getList({ page: 1, pageSize: 1000 })
    if (metaRes.success && metaRes.data) {
      const unique = new Set()
      metaRes.data.forEach(s => { if (s.country) unique.add(s.country) })
      countries.value = Array.from(unique).sort()
    }
  } catch (e) {
    console.warn('加载地区列表失败', e)
  }
  await loadSeries()
})
</script>

<style scoped>
.series-list {
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

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
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
  transition: background 0.2s;
}

.batch-delete-btn:hover {
  background: #c0392b;
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

.series-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

.series-card {
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  transition: border 0.2s, background 0.2s;
}

.series-card.selected {
  background: #e3f2fd;
  border: 2px solid #2196f3;
}

.card-main {
  display: flex;
  flex-direction: row;
  align-items: stretch;
  flex: 1;
  cursor: pointer;
}

.card-checkbox-col {
  display: flex;
  align-items: center;
  padding: 0 8px;
  flex-shrink: 0;
}

.card-checkbox {
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.card-body {
  padding: 16px;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  cursor: pointer;
}

.info-row {
  display: flex;
  align-items: center;
  gap: 6px;
  overflow: hidden;
}

.info-row .name {
  font-size: 16px;
  font-weight: bold;
  color: #333;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.right-tags {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.like-count {
  font-size: 12px;
  color: #e74c3c;
  background: #fce4ec;
  padding: 2px 6px;
  border-radius: 3px;
  white-space: nowrap;
}

.video-count {
  font-size: 12px;
  color: #666;
  background: #f5f5f5;
  padding: 2px 6px;
  border-radius: 3px;
  white-space: nowrap;
}

.country-tag {
  background: #f3e5f5;
  color: #7b1fa2;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 12px;
  white-space: nowrap;
}

.alias-row {
  overflow: hidden;
}

.alias-row .alias {
  font-size: 13px;
  color: #999;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: block;
}

.empty-hint {
  text-align: center;
  color: #999;
  padding: 40px;
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
  background: #fff;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: background 0.2s;
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

@media (max-width: 768px) {
  .series-grid {
    grid-template-columns: repeat(1, 1fr);
  }
  .list-header {
    flex-direction: column;
    gap: 12px;
    align-items: flex-start;
  }
}
</style>
