<template>
  <div class="comic-list">
    <div class="list-header">
      <h1>漫画管理</h1>
      <div class="header-actions">
        <button class="add-btn" @click="handleAdd">添加漫画</button>
      </div>
    </div>

    <div class="filters">
      <input
        v-model="keyword"
        placeholder="搜索漫画名称或作者..."
        type="text"
        @keyup.enter="handleSearch"
      />
      <select v-model.number="statusFilter" @change="handleSearch" class="status-select">
        <option :value="-1">全部状态</option>
        <option :value="0">连载中</option>
        <option :value="1">完结</option>
      </select>
      <select v-model="sortBy" @change="handleSearch" class="status-select">
        <option value="">默认排序</option>
        <option value="name">按名称</option>
        <option value="likes">按点赞</option>
      </select>
      <button class="search-btn" @click="handleSearch">搜索</button>
    </div>

    <div class="comic-grid" v-if="comicList.length > 0">
      <ComicCard
        v-for="comic in comicList"
        :key="comic.id"
        :comic="comic"
        @click="goToDetail"
        @edit="handleEdit"
        @delete="handleDelete"
      >
        <template #actions>
          <button class="btn btn-sm btn-primary" @click="handleEdit(comic)">编辑</button>
          <button class="btn btn-sm btn-danger" @click="handleDelete(comic)">删除</button>
        </template>
      </ComicCard>
    </div>

    <div class="empty-hint" v-if="comicList.length === 0 && !loading">
      暂无漫画，点击上方「添加漫画」开始
    </div>

    <div class="loading-hint" v-if="loading">加载中...</div>

    <div class="pagination" v-if="total > 0">
      <button :disabled="page === 1" @click="changePage(page - 1)">上一页</button>
      <span>第 {{ page }} 页 / 共 {{ Math.ceil(total / pageSize) }} 页（共 {{ total }} 条）</span>
      <input class="goto-input" v-model.number="gotoVal" type="number" min="1"
        :max="Math.ceil(total / pageSize)" placeholder="跳转" @keyup.enter="handleGotoPage" />
      <button @click="handleGotoPage">跳转</button>
      <button :disabled="page * pageSize >= total" @click="changePage(page + 1)">下一页</button>
    </div>

    <!-- 添加/编辑对话框 -->
    <ComicFormDialog
      :visible="showDialog"
      :editing-comic="editingComic"
      @update:visible="showDialog = $event"
      @save="handleSave"
      @cancel="handleCancel"
    />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { comicApi } from '@/scripts/api'
import ComicCard from '@/views/components/ComicCard.vue'
import ComicFormDialog from '@/views/components/ComicFormDialog.vue'

const router = useRouter()
const comicList = ref([])
const page = ref(1)
const pageSize = ref(24)
const total = ref(0)
const keyword = ref('')
const statusFilter = ref(-1)
const sortBy = ref('')
const loading = ref(false)
const showDialog = ref(false)
const editingComic = ref(null)
const gotoVal = ref()

const loadComics = async () => {
  loading.value = true
  try {
    const params = { pageIndex: page.value, pageSize: pageSize.value }
    if (keyword.value) params.keyword = keyword.value
    if (statusFilter.value >= 0) params.status = statusFilter.value
    if (sortBy.value) params.sortBy = sortBy.value
    const res = await comicApi.getList(params)
    if (res.success) {
      comicList.value = res.data?.list || []
      total.value = res.data?.total || 0
    }
  } catch (error) {
    console.error('加载漫画失败:', error)
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  page.value = 1
  loadComics()
}

const handleGotoPage = () => {
  const totalPages = Math.ceil(total.value / pageSize.value)
  const p = gotoVal.value
  if (!p || p < 1 || p > totalPages) return
  changePage(p)
  gotoVal.value = undefined
}

const changePage = (p) => {
  page.value = p
  loadComics()
}

const goToDetail = (comic) => {
  router.push(`/comic/${comic.id}`)
}

const handleCancel = () => {
  showDialog.value = false
}

const handleAdd = () => {
  editingComic.value = null
  showDialog.value = true
}

const handleEdit = (comic) => {
  editingComic.value = comic
  showDialog.value = true
}

const handleSave = async (form) => {
  try {
    if (editingComic.value?.id) {
      await comicApi.update(editingComic.value.id, form)
    } else {
      await comicApi.add(form)
    }
  } catch (error) {
    alert('保存失败：' + (error.message || error))
    return
  }
  showDialog.value = false
  editingComic.value = null
  await loadComics()
}

const handleDelete = async (comic) => {
  if (!confirm(`确定要删除漫画「${comic.name}」吗？`)) return
  try {
    await comicApi.delete(comic.id)
    await loadComics()
  } catch (error) {
    alert('删除失败：' + (error.message || error))
  }
}



onMounted(() => {
  loadComics()
})
</script>

<style scoped>
.comic-list {
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

.add-btn:hover { background: #2980b9; }

.filters {
  display: flex;
  gap: 8px;
  align-items: center;
}

.status-select {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
}

.filters input[type="text"] {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  height: 38px;
  min-width: 200px;
}

.search-btn {
  padding: 8px 16px;
  height: 38px;
  background: #3498db;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: background 0.2s;
}

.search-btn:hover { background: #2980b9; }

.comic-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

.empty-hint {
  text-align: center;
  color: #999;
  font-size: 16px;
}

.loading-hint {
  text-align: center;
  color: #888;
}

/* 分页器 */
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


@media (max-width: 1024px) {
  .comic-grid { grid-template-columns: repeat(3, 1fr); }
}

@media (max-width: 768px) {
  .comic-grid { grid-template-columns: repeat(2, 1fr); gap: 12px; }
}
</style>
