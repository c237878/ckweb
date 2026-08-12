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
      <button class="search-btn" @click="handleSearch">搜索</button>
    </div>

    <div class="comic-grid" v-if="comicList.length > 0">
      <div
        class="comic-card"
        v-for="comic in comicList"
        :key="comic.id"
        @click="goToDetail(comic.id)"
      >
        <div class="card-cover">
          <img v-if="comic.coverPath" :src="'/api/comic/image/cover/' + encodeURIComponent(comic.coverPath)" @error="handleImgError" alt="封面" />
          <div v-else class="cover-placeholder">📖</div>
        </div>
        <div class="card-info">
          <div class="comic-name">{{ comic.name }}</div>
          <div class="comic-author" v-if="comic.author">{{ comic.author }}</div>
          <div class="comic-meta">
            <span class="chapter-count">{{ comic.chapterCount }} 章</span>
          </div>
          <div class="card-actions" @click.stop>
            <button class="btn btn-sm btn-primary" @click="handleEdit(comic)">编辑</button>
            <button class="btn btn-sm btn-danger" @click="handleDelete(comic)">删除</button>
          </div>
        </div>
      </div>
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
    <Dialog :visible="showDialog" :title="editingComic ? '编辑漫画' : '添加漫画'" @cancel="handleCancel" @confirm="handleSave">
      <template #content>
        <div class="form-group">
          <label>名称 *</label>
          <input v-model="form.name" type="text" placeholder="漫画名称" />
        </div>
        <div class="form-group">
          <label>作者</label>
          <input v-model="form.author" type="text" placeholder="作者" />
        </div>
        <div class="form-group">
          <label>介绍</label>
          <textarea v-model="form.description" placeholder="简介" rows="3"></textarea>
        </div>
        <div class="form-group">
          <label>链接</label>
          <input v-model="form.url" type="text" placeholder="外部链接（可选）" />
        </div>
        <div class="form-group">
          <label>封面路径</label>
          <input v-model="form.coverPath" type="text" placeholder="封面图片路径（可选）" />
        </div>
        <div class="form-group">
          <label>目录</label>
          <input v-model="form.directory" type="text" placeholder="漫画根目录路径" />
          <small>章节图片所在目录</small>
        </div>
      </template>
      <template #actions>
        <button class="btn" @click="handleCancel">取消</button>
        <button class="btn btn-primary" @click="handleSave">保存</button>
      </template>
    </Dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { comicApi } from '@/scripts/api'
import Dialog from '@/views/components/Dialog.vue'

const router = useRouter()
const comicList = ref([])
const page = ref(1)
const pageSize = ref(24)
const total = ref(0)
const keyword = ref('')
const loading = ref(false)
const showDialog = ref(false)
const editingComic = ref(null)
const form = ref({ name: '', author: '', description: '', url: '', coverPath: '', directory: '' })
const gotoVal = ref()

const loadComics = async () => {
  loading.value = true
  try {
    const params = { pageIndex: page.value, pageSize: pageSize.value }
    if (keyword.value) params.keyword = keyword.value
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

const goToDetail = (id) => {
  router.push(`/comic/${id}`)
}

const handleAdd = () => {
  editingComic.value = null
  form.value = { name: '', author: '', description: '', url: '', coverPath: '', directory: '' }
  showDialog.value = true
}

const handleEdit = (comic) => {
  editingComic.value = comic
  form.value = {
    name: comic.name || '',
    author: comic.author || '',
    description: comic.description || '',
    url: comic.url || '',
    coverPath: comic.coverPath || '',
    directory: comic.directory || ''
  }
  showDialog.value = true
}

const handleSave = async () => {
  if (!form.value.name?.trim()) {
    alert('名称不能为空')
    return
  }
  try {
    if (editingComic.value?.id) {
      await comicApi.update(editingComic.value.id, form.value)
    } else {
      await comicApi.add(form.value)
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

const handleCancel = () => {
  showDialog.value = false
  editingComic.value = null
}

const handleImgError = (e) => {
  e.target.style.display = 'none'
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
  padding: 0 20px 20px;
}

.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 0;
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

.filters input[type="text"] {
  padding: 8px 16px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  min-width: 280px;
}

.search-btn {
  padding: 8px 16px;
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

.comic-card {
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  overflow: hidden;
  cursor: pointer;
  transition: box-shadow 0.3s;
  display: flex;
  flex-direction: column;
}

.comic-card:hover {
  box-shadow: 0 4px 16px rgba(0,0,0,0.18);
}

.card-cover {
  width: 100%;
  aspect-ratio: 3/4;
  overflow: hidden;
  background: #f0f0f0;
  position: relative;
}

.card-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cover-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 48px;
  background: #e8e8e8;
}

.card-info {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
}

.comic-name {
  font-size: 15px;
  font-weight: bold;
  color: #333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.comic-author {
  font-size: 12px;
  color: #888;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.comic-meta {
  margin-top: 4px;
}

.chapter-count {
  font-size: 12px;
  color: #666;
  background: #f5f5f5;
  padding: 2px 8px;
  border-radius: 3px;
}

.card-actions {
  display: flex;
  gap: 6px;
  margin-top: 8px;
}

.btn {
  padding: 4px 12px;
  border: 1px solid #ddd;
  background: #fff;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.btn-sm {
  padding: 3px 10px;
  font-size: 12px;
}

.btn-primary {
  background: #3498db;
  color: white;
  border-color: #3498db;
}

.btn-primary:hover { background: #2980b9; }

.btn-danger {
  background: #e74c3c;
  color: white;
  border-color: #e74c3c;
}

.btn-danger:hover { background: #c0392b; }

.empty-hint {
  text-align: center;
  color: #999;
  padding: 60px;
  font-size: 16px;
}

.loading-hint {
  text-align: center;
  color: #888;
  padding: 40px;
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 12px;
}

.pagination button {
  padding: 8px 16px;
  border: 1px solid #ddd;
  background: #fff;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
}

.pagination button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.goto-input {
  width: 60px;
  padding: 4px 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 13px;
  text-align: center;
}

.pagination span {
  font-size: 14px;
  color: #666;
}

/* Dialog form styles */
.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: #333;
  margin-bottom: 6px;
}

.form-group input,
.form-group textarea {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  box-sizing: border-box;
}

.form-group input:focus,
.form-group textarea:focus {
  outline: none;
  border-color: #3498db;
}

.form-group textarea {
  resize: vertical;
}

.form-group small {
  display: block;
  margin-top: 4px;
  color: #999;
  font-size: 12px;
}

@media (max-width: 1024px) {
  .comic-grid { grid-template-columns: repeat(3, 1fr); }
}

@media (max-width: 768px) {
  .comic-grid { grid-template-columns: repeat(2, 1fr); gap: 12px; }
}
</style>
