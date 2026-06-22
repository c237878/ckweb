<template>
  <div class="series-list">
    <div class="list-header">
      <h1>影视系列</h1>
      <button class="add-btn" @click="handleAdd">添加系列</button>
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
        <div class="card-body">
          <!-- 第一行：名称(加粗, flex:1) + 获赞数 + 影片数 + 国家(紫色tag) -->
          <div class="info-row">
            <span class="name">{{ series.name }}</span>
            <div class="right-tags">
              <span v-if="series.likeCount > 0" class="like-count">♥ {{ series.likeCount }}</span>
              <span v-if="series.videoCount > 0" class="video-count">{{ series.videoCount }} 部</span>
              <span v-if="series.country" class="country-tag">{{ series.country }}</span>
            </div>
          </div>
          <!-- 第二行：别名（灰色小字，ellipsis 单行溢出） -->
          <div class="info-row alias-row" v-if="series.alias">
            <span class="alias">{{ series.alias }}</span>
          </div>
        </div>
        <!-- 第三行：CardActions -->
        <CardActions>
          <button v-if="series.link" class="btn" @click.stop="openLink(series.link)">链接</button>
          <button class="btn btn-primary" @click.stop="handleEdit(series)">编辑</button>
          <button class="btn btn-success" @click.stop="goToVideos(series.id)">详情</button>
        </CardActions>
      </div>
    </div>
    <div class="empty-hint" v-if="seriesList.length === 0 && !loading">暂无系列</div>
    <div class="pagination" v-if="total > pageSize">
      <button :disabled="page === 1" @click="changePage(page - 1)">上一页</button>
      <span>第 {{ page }} 页 / 共 {{ Math.ceil(total / pageSize) }} 页</span>
      <button :disabled="page * pageSize >= total" @click="changePage(page + 1)">下一页</button>
    </div>

    <!-- 使用 AddSeriesDialog 弹窗 -->
    <AddSeriesDialog
      :visible="showDialog"
      :editing-series="editingSeries"
      @save="handleSave"
      @cancel="handleCancel"
    />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { seriesApi } from '@/scripts/api'
import CardActions from '@/views/components/CardActions.vue'
import AddSeriesDialog from '@/views/components/AddSeriesDialog.vue'

const router = useRouter()
const seriesList = ref([])
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)
const keyword = ref('')
const loading = ref(false)
const showDialog = ref(false)
const editingSeries = ref(null)

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

const handleSave = async () => {
  showDialog.value = false
  editingSeries.value = null
  await loadSeries()
}

const handleCancel = () => {
  showDialog.value = false
  editingSeries.value = null
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
  display: flex;
  flex-direction: column;
}

.card-body {
  padding: 16px;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

/* 统一信息行样式 */
.info-row {
  display: flex;
  align-items: center;
  gap: 6px;
  overflow: hidden;
}

/* 第一行：名称 */
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

/* 右侧标签组 */
.right-tags {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

/* 获赞数 */
.like-count {
  font-size: 12px;
  color: #e74c3c;
  background: #fce4ec;
  padding: 2px 6px;
  border-radius: 3px;
  white-space: nowrap;
}

/* 影片数 */
.video-count {
  font-size: 12px;
  color: #666;
  background: #f5f5f5;
  padding: 2px 6px;
  border-radius: 3px;
  white-space: nowrap;
}

/* 国家 tag - 紫色 */
.country-tag {
  background: #f3e5f5;
  color: #7b1fa2;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 12px;
  white-space: nowrap;
}

/* 第二行：别名（单行溢出省略号） */
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
