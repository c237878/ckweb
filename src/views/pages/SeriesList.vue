<template>
  <div class="series-list">
    <div class="list-header">
      <h1>影视系列</h1>
      <button class="add-btn" @click="showAddDialog = true">添加系列</button>
    </div>
    <div class="filters">
      <input
        v-model="keyword"
        placeholder="搜索系列..."
        class="search-input"
        @keyup.enter="loadSeries"
      />
      <button class="search-btn" @click="loadSeries">搜索</button>
    </div>
    <div class="series-grid">
      <div class="series-card" v-for="series in seriesList" :key="series.id">
        <div class="card-body" @click="goToVideos(series.id)">
          <div class="series-name">{{ series.name }}</div>
          <div class="series-info">
            <span v-if="series.description" class="desc">{{ series.description }}</span>
            <span class="count">{{ series.videoCount || 0 }} 部影片</span>
          </div>
        </div>
        <div class="card-actions">
          <button class="edit-btn" @click.stop="handleEdit(series)">编辑</button>
          <button class="delete-btn" @click.stop="handleDelete(series.id)">删除</button>
        </div>
      </div>
    </div>
    <div class="empty-hint" v-if="seriesList.length === 0 && !loading">暂无系列</div>
    <div class="pagination" v-if="total > pageSize">
      <button :disabled="page === 1" @click="changePage(page - 1)">上一页</button>
      <span>第 {{ page }} 页 / 共 {{ Math.ceil(total / pageSize) }} 页</span>
      <button :disabled="page * pageSize >= total" @click="changePage(page + 1)">下一页</button>
    </div>

    <!-- 添加/编辑弹窗 -->
    <div class="dialog-overlay" v-if="showAddDialog" @mousedown="handleOverlayDown" @click="handleOverlayClick">
      <div class="dialog">
        <h3>{{ editingSeries ? '编辑系列' : '添加系列' }}</h3>
        <div class="form-group">
          <label>名称</label>
          <input v-model="formData.name" placeholder="系列名称" />
        </div>
        <div class="form-group">
          <label>描述</label>
          <textarea v-model="formData.description" placeholder="系列描述（可选）" rows="3"></textarea>
        </div>
        <div class="dialog-actions">
          <button class="cancel-btn" @click="showAddDialog = false; editingSeries = null">取消</button>
          <button class="save-btn" @click="handleSave">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { seriesApi } from '@/scripts/api'

const router = useRouter()
const seriesList = ref([])
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)
const keyword = ref('')
const loading = ref(false)
const showAddDialog = ref(false)
const editingSeries = ref(null)
const formData = ref({ name: '', description: '' })

let mouseDownOnDialog = false

const loadSeries = async () => {
  loading.value = true
  try {
    const res = await seriesApi.getList({ page: page.value, pageSize: pageSize.value, keyword: keyword.value })
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

const changePage = (p) => {
  page.value = p
  loadSeries()
}

const goToVideos = (seriesId) => {
  router.push({ path: '/videos', query: { seriesId } })
}

const handleEdit = (series) => {
  editingSeries.value = series
  formData.value = { name: series.name, description: series.description || '' }
  showAddDialog.value = true
}

const handleDelete = async (id) => {
  if (!confirm('确定要删除此系列吗？')) return
  try {
    await seriesApi.delete(id)
    await loadSeries()
  } catch (error) {
    console.error('删除失败:', error)
  }
}

const handleSave = async () => {
  if (!formData.value.name.trim()) return
  try {
    if (editingSeries.value) {
      await seriesApi.update(editingSeries.value.id, formData.value)
    } else {
      await seriesApi.add(formData.value)
    }
    showAddDialog.value = false
    editingSeries.value = null
    formData.value = { name: '', description: '' }
    await loadSeries()
  } catch (error) {
    console.error('保存失败:', error)
  }
}

const handleOverlayDown = (e) => {
  const dialog = e.currentTarget.querySelector('.dialog')
  mouseDownOnDialog = dialog && dialog.contains(e.target)
}
const handleOverlayClick = () => {
  if (!mouseDownOnDialog) {
    showAddDialog.value = false
    editingSeries.value = null
  }
}

onMounted(() => {
  loadSeries()
})
</script>

<style scoped>
.series-list {
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

.search-input {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  flex: 1;
  max-width: 300px;
}

.search-btn {
  padding: 8px 16px;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}

.search-btn:hover {
  background: #0056b3;
}

.series-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-bottom: 30px;
}

.series-card {
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  transition: box-shadow 0.3s;
}

.series-card:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
}

.card-body {
  padding: 16px;
  cursor: pointer;
}

.series-name {
  font-size: 18px;
  font-weight: bold;
  color: #333;
  margin-bottom: 8px;
}

.series-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.series-info .desc {
  font-size: 13px;
  color: #999;
  line-height: 1.4;
}

.series-info .count {
  font-size: 13px;
  color: #666;
}

.card-actions {
  display: flex;
  gap: 8px;
  padding: 0 16px 12px;
}

.edit-btn, .delete-btn {
  padding: 6px 14px;
  border: 1px solid #ddd;
  background: white;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}

.edit-btn:hover {
  background: #f0f0f0;
}

.delete-btn {
  color: #e74c3c;
  border-color: #e74c3c;
}

.delete-btn:hover {
  background: #e74c3c;
  color: white;
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
  margin-top: 30px;
}

.pagination button {
  padding: 8px 16px;
  border: 1px solid #ddd;
  background: white;
  border-radius: 6px;
  cursor: pointer;
}

.pagination button:hover:not(:disabled) {
  background: #f5f5f5;
}

.pagination button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 弹窗 */
.dialog-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.dialog {
  background: white;
  border-radius: 12px;
  padding: 24px;
  width: 400px;
  max-width: 90vw;
}

.dialog h3 {
  margin: 0 0 20px;
  font-size: 20px;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  font-size: 14px;
  font-weight: bold;
  margin-bottom: 6px;
  color: #333;
}

.form-group input,
.form-group textarea {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  box-sizing: border-box;
}

.form-group textarea {
  resize: vertical;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px;
}

.cancel-btn {
  padding: 8px 20px;
  border: 1px solid #ddd;
  background: white;
  border-radius: 6px;
  cursor: pointer;
}

.save-btn {
  padding: 8px 20px;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}

.save-btn:hover {
  background: #0056b3;
}

@media (max-width: 768px) {
  .series-grid {
    grid-template-columns: 1fr;
  }
  .list-header {
    flex-direction: column;
    gap: 12px;
    align-items: flex-start;
  }
}

@media (min-width: 769px) and (max-width: 1200px) {
  .series-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
