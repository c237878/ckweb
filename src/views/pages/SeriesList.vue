<template>
  <div class="series-list">
    <div class="list-header">
      <h1>影视系列</h1>
      <button class="add-btn" @click="showAddDialog = true">添加系列</button>
    </div>
    <div class="filters">
      <select v-model="filters.country" @change="loadSeries">
        <option value="">全部类型</option>
        <option v-for="country in existingCountries" :key="country" :value="country">
          {{ country }}
        </option>
      </select>
    </div>
    <div class="series-grid">
      <div class="series-card" v-for="series in seriesList" :key="series.id">
        <div class="card-body" @click="goToDetail(series.id)">
          <div class="row1">
            <span class="name">{{ series.name }}</span>
            <span class="type-tag">{{ series.country || '未设置' }}</span>
          </div>
          <div class="row2">
            <span v-if="series.alias" class="alias">{{ series.alias }}</span>
            <span class="count">{{ series.videoCount || 0 }} 部影片</span>
          </div>
        </div>
        <div class="card-actions">
          <button class="edit-btn" @click.stop="handleEditSeries(series)">编辑</button>
        </div>
      </div>
    </div>
    <div class="pagination" v-if="total > pageSize">
      <button :disabled="page === 1" @click="changePage(page - 1)">上一页</button>
      <span>第 {{ page }} 页</span>
      <button :disabled="page * pageSize >= total" @click="changePage(page + 1)">下一页</button>
    </div>

    <AddSeriesDialog
      :visible="showAddDialog"
      :editing-series="editingSeries"
      @save="handleSaveSeries"
      @cancel="showAddDialog = false; editingSeries = null"
      @delete="handleDeleteSeries"
    />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { seriesApi } from '@/scripts/api'
import AddSeriesDialog from '@/views/components/AddSeriesDialog.vue'

const router = useRouter()
const seriesList = ref([])
const existingCountries = ref([])
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)
const filters = ref({
  country: ''
})
const showAddDialog = ref(false)
const editingSeries = ref(null)

onMounted(async () => {
  await Promise.all([
    loadSeries(),
    loadExistingCountries()
  ])
})

const loadSeries = async () => {
  try {
    const params = {
      page: page.value,
      pageSize: pageSize.value
    }
    if (filters.value.country) params.country = filters.value.country

    const res = await seriesApi.getList(params)
    if (res.success) {
      seriesList.value = res.data
      total.value = res.total
    }
  } catch (error) {
    console.error('加载系列失败:', error)
  }
}

const loadExistingCountries = async () => {
  try {
    const res = await seriesApi.getList({ page: 1, pageSize: 1000 })
    if (res.success && res.data) {
      const countries = new Set()
      res.data.forEach(series => {
        if (series.country) countries.add(series.country)
      })
      existingCountries.value = Array.from(countries)
    }
  } catch (error) {
    console.error('加载类型列表失败:', error)
  }
}

const changePage = (newPage) => {
  page.value = newPage
  loadSeries()
}

const goToDetail = (id) => {
  router.push(`/series/${id}`)
}

const handleEditSeries = (series) => {
  editingSeries.value = series
  showAddDialog.value = true
}

const handleDeleteSeries = async (seriesId) => {
  try {
    const res = await seriesApi.delete(seriesId)
    if (res.success) {
      showAddDialog.value = false
      editingSeries.value = null
      alert('删除成功！')
      await loadSeries()
    } else {
      alert('删除失败：' + res.message)
    }
  } catch (error) {
    console.error('删除系列失败:', error)
    alert('删除失败：' + error.message)
  }
}

const handleSaveSeries = async (seriesData) => {
  try {
    let res
    if (editingSeries.value) {
      res = await seriesApi.update(editingSeries.value.id, seriesData)
    } else {
      res = await seriesApi.add(seriesData)
    }

    if (res.success) {
      showAddDialog.value = false
      editingSeries.value = null
      await loadSeries()
      alert(editingSeries.value ? '更新成功！' : '添加成功！')
    } else {
      alert('操作失败：' + res.message)
    }
  } catch (error) {
    console.error('保存系列失败:', error)
    alert('操作失败：' + error.message)
  }
}
</script>

<style scoped>
.series-list {
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
}

.filters select {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  color: #333;
}

.series-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 16px;
  margin-bottom: 30px;
}

.series-card {
  cursor: pointer;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition: transform 0.3s;
  background: #fff;
  display: flex;
  flex-direction: column;
}

.series-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.card-body {
  padding: 16px;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.row1 {
  display: flex;
  justify-content: space-between;
  align-items: center;
  overflow: hidden;
}

.name {
  font-size: 16px;
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
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
  color: #999;
}

.alias {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  margin-right: 8px;
  color: #999;
}

.count {
  white-space: nowrap;
  flex-shrink: 0;
  color: #999;
}

.card-actions {
  padding: 10px 16px;
  border-top: 1px solid #f5f5f5;
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
