<template>
  <div class="like-list">
    <div class="list-header">
      <h1>点赞记录</h1>
      <div class="header-actions">
        <button v-if="selectedIds.length > 0" class="btn btn-danger" @click="handleBatchDelete">
          删除选中 ({{ selectedIds.length }})
        </button>
      </div>
    </div>

    <div class="filters">
      <input
        v-model="keyword"
        placeholder="搜索名称或番号..."
        type="text"
        @keyup.enter="handleSearch"
      />
      <select v-model="targetType" @change="handleSearch" class="status-select">
        <option value="">全部类型</option>
        <option value="video">影片</option>
        <option value="comic">漫画</option>
      </select>
      <input
        v-model="startDate"
        type="date"
        @change="handleSearch"
        class="date-input"
      />
      <span class="date-sep">~</span>
      <input
        v-model="endDate"
        type="date"
        @change="handleSearch"
        class="date-input"
      />
      <button class="search-btn" @click="handleSearch">搜索</button>
    </div>

    <div v-if="loading" class="loading">加载中...</div>

    <div v-else-if="likeList.length === 0" class="empty">暂无点赞记录</div>

    <table v-else class="like-table">
      <thead>
        <tr>
          <th class="col-check"><input type="checkbox" :checked="allChecked" @change="toggleAll" /></th>
          <th class="col-cover">封面</th>
          <th class="col-name">名称</th>
          <th class="col-code">番号</th>
          <th class="col-type">类型</th>
          <th class="col-time">点赞时间</th>
          <th class="col-actions">操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="item in likeList" :key="item.id">
          <td><input type="checkbox" :checked="selectedIds.includes(item.id)" @change="toggleSelect(item.id)" /></td>
          <td>
            <img
              v-if="item.coverPath"
              :src="getCoverUrl(item)"
              class="row-cover"
              @click="goToDetail(item)"
            />
            <span v-else class="no-cover">无封面</span>
          </td>
          <td class="col-name-cell" @click="goToDetail(item)">{{ item.name || '(已删除)' }}</td>
          <td>{{ item.code || '-' }}</td>
          <td>
            <span :class="['type-badge', item.targetType]">
              {{ item.targetType === 'comic' ? '漫画' : '影片' }}
            </span>
          </td>
          <td>{{ item.likedAt }}</td>
          <td>
            <button class="btn btn-danger btn-sm" @click="handleDelete(item)">删除</button>
          </td>
        </tr>
      </tbody>
    </table>

    <div class="pagination" v-if="total > 0">
      <button :disabled="page <= 1" @click="changePage(page - 1)">上一页</button>
      <span class="page-info">{{ page }} / {{ totalPages }}</span>
      <button :disabled="page >= totalPages" @click="changePage(page + 1)">下一页</button>
      <span class="total-info">共 {{ total }} 条</span>
      <input
        v-model.number="gotoVal"
        type="number"
        class="goto-input"
        placeholder="页码"
        @keyup.enter="handleGotoPage"
      />
      <button @click="handleGotoPage">跳转</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { likeApi, videoApi, comicApi } from '@/scripts/api'

const router = useRouter()

const likeList = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = 20
const loading = ref(false)
const keyword = ref('')
const targetType = ref('')
const startDate = ref('')
const endDate = ref('')
const selectedIds = ref([])
const gotoVal = ref()

const totalPages = computed(() => Math.ceil(total.value / pageSize.value))
const allChecked = computed(() =>
  likeList.value.length > 0 && likeList.value.every(i => selectedIds.value.includes(i.id))
)

const getCoverUrl = (item) => {
  if (item.targetType === 'comic') {
    return comicApi.getCoverUrl(item.coverPath)
  }
  return `/api/video/cover/${item.videoId}`
}

const goToDetail = (item) => {
  if (item.targetType === 'comic') {
    router.push(`/comic/${item.videoId}`)
  } else {
    router.push(`/video/${item.videoId}`)
  }
}

const loadList = async () => {
  loading.value = true
  try {
    const params = { pageIndex: page.value, pageSize }
    if (keyword.value) params.keyword = keyword.value
    if (targetType.value) params.targetType = targetType.value
    if (startDate.value) params.startDate = startDate.value
    if (endDate.value) params.endDate = endDate.value
    const res = await likeApi.getList(params)
    if (res.success) {
      likeList.value = res.data?.list || []
      total.value = res.data?.total || 0
    }
  } catch (error) {
    console.error('加载点赞记录失败:', error)
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  page.value = 1
  selectedIds.value = []
  loadList()
}

const changePage = (p) => {
  if (p < 1 || p > totalPages.value) return
  page.value = p
  selectedIds.value = []
  loadList()
}

const handleGotoPage = () => {
  if (!gotoVal.value || gotoVal.value < 1 || gotoVal.value > totalPages.value) return
  changePage(gotoVal.value)
  gotoVal.value = undefined
}

const toggleAll = (e) => {
  if (e.target.checked) {
    selectedIds.value = likeList.value.map(i => i.id)
  } else {
    selectedIds.value = []
  }
}

const toggleSelect = (id) => {
  const idx = selectedIds.value.indexOf(id)
  if (idx >= 0) {
    selectedIds.value.splice(idx, 1)
  } else {
    selectedIds.value.push(id)
  }
}

const handleDelete = async (item) => {
  if (!confirm(`确认删除这条点赞记录？\n${item.name || ''}`)) return
  try {
    const res = await likeApi.delete(item.id)
    if (res.success) {
      loadList()
    }
  } catch (error) {
    console.error('删除失败:', error)
  }
}

const handleBatchDelete = async () => {
  if (selectedIds.value.length === 0) return
  if (!confirm(`确认删除选中的 ${selectedIds.value.length} 条记录？`)) return
  try {
    const res = await likeApi.batchDelete([...selectedIds.value])
    if (res.success) {
      selectedIds.value = []
      loadList()
    }
  } catch (error) {
    console.error('批量删除失败:', error)
  }
}

onMounted(() => {
  loadList()
})
</script>

<style scoped>
.like-list {
  max-width: 1400px;
  margin: 0 auto;
  padding: 16px;
}

.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.list-header h1 {
  margin: 0;
  font-size: 22px;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.filters {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  flex-wrap: wrap;
  align-items: center;
}

.filters input[type="text"] {
  flex: 1;
  min-width: 200px;
  padding: 6px 10px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
}

.status-select {
  padding: 6px 10px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
}

.date-input {
  padding: 6px 10px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
}

.date-sep {
  color: #999;
}

.search-btn {
  padding: 6px 16px;
  background: #3498db;
  color: #fff;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
}

.search-btn:hover {
  background: #2980b9;
}

.loading, .empty {
  text-align: center;
  padding: 40px;
  color: #999;
}

.like-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.like-table th,
.like-table td {
  padding: 8px 10px;
  border-bottom: 1px solid #eee;
  text-align: left;
}

.like-table th {
  background: #f5f5f5;
  font-weight: 600;
}

.col-check {
  width: 40px;
}

.col-cover {
  width: 60px;
}

.row-cover {
  width: 40px;
  height: 56px;
  object-fit: cover;
  border-radius: 4px;
  cursor: pointer;
}

.no-cover {
  display: inline-block;
  width: 40px;
  height: 56px;
  line-height: 56px;
  text-align: center;
  background: #f0f0f0;
  border-radius: 4px;
  font-size: 11px;
  color: #ccc;
}

.col-name-cell {
  cursor: pointer;
  color: #3498db;
}

.col-name-cell:hover {
  text-decoration: underline;
}

.type-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 600;
}

.type-badge.video {
  background: #e8f4fd;
  color: #3498db;
}

.type-badge.comic {
  background: #fff3e0;
  color: #e67e22;
}

.col-actions {
  width: 80px;
}

.btn {
  padding: 4px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  background: #fff;
}

.btn-danger {
  color: #e74c3c;
  border-color: #e74c3c;
}

.btn-danger:hover {
  background: #e74c3c;
  color: #fff;
}

.btn-sm {
  padding: 2px 8px;
  font-size: 12px;
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
  margin-top: 16px;
  flex-wrap: wrap;
}

.pagination button {
  padding: 4px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  cursor: pointer;
  background: #fff;
}

.pagination button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.page-info {
  font-size: 14px;
}

.total-info {
  font-size: 13px;
  color: #999;
}

.goto-input {
  width: 60px;
  padding: 4px;
  border: 1px solid #ddd;
  border-radius: 6px;
  text-align: center;
}
</style>
