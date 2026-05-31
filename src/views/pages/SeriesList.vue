<template>
  <div class="series-list">
    <div class="list-header">
      <h1>影视系列</h1>
      <button class="add-btn" @click="showAddDialog = true">添加系列</button>
    </div>
    <div class="series-grid">
      <div class="series-card" v-for="series in seriesList" :key="series.id">
        <div class="series-info" @click="goToDetail(series.id)">
          <h3>{{ series.name }}</h3>
          <p v-if="series.alias" class="series-alias">{{ series.alias }}</p>
          <p class="series-type">{{ series.country || '未设置' }}</p>
          <p class="count">{{ series.videoCount || 0 }} 部影片</p>
        </div>
        <div class="series-actions">
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
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)
const showAddDialog = ref(false)
const editingSeries = ref(null)

onMounted(() => {
  loadSeries()
})

const loadSeries = async () => {
  try {
    const res = await seriesApi.getList({ page: page.value, pageSize: pageSize.value })
    if (res.success) {
      seriesList.value = res.data
      total.value = res.total
    }
  } catch (error) {
    console.error('加载系列失败:', error)
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
  margin-bottom: 30px;
}

h1 {
  margin: 0;
}

.add-btn {
  padding: 10px 25px;
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

.series-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
}

.series-card {
  cursor: pointer;
  padding: 20px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition: transform 0.3s;
  display: flex;
  flex-direction: column;
}

.series-card:hover {
  transform: translateY(-5px);
}

.series-info {
  flex: 1;
}

.series-info h3 {
  font-size: 18px;
  margin-bottom: 10px;
}

.series-alias {
  color: #999;
  font-size: 13px;
  margin-bottom: 5px;
}

.series-type {
  color: #3498db;
  font-size: 12px;
  margin-bottom: 5px;
}

.series-info .count {
  margin-top: 10px;
  color: #e74c3c;
  font-weight: bold;
}

.series-actions {
  padding: 10px 15px;
  border-top: 1px solid #f0f0f0;
  display: flex;
  justify-content: flex-end;
  margin-top: 15px;
}

.edit-btn {
  padding: 6px 20px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
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
