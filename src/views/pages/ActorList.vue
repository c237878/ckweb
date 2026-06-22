<template>
  <div class="actor-list">
    <div class="list-header">
      <h1>演员列表</h1>
      <button class="add-btn" @click="handleAdd">添加演员</button>
    </div>
    <div class="filters">
      <input
        v-model="keyword"
        placeholder="搜索演员..."
        class="search-input"
        @keyup.enter="loadActors"
      />
      <button class="search-btn" @click="loadActors">搜索</button>
    </div>
    <div class="actor-grid">
      <div class="actor-card" v-for="actor in actors" :key="actor.id">
        <div class="card-body" @click="goToDetail(actor.id)">
          <!-- 第一行：姓名(加粗, flex:1) + 获赞数 + 影片数 + 国家(紫色tag) -->
          <div class="info-row">
            <span class="name">{{ actor.name }}</span>
            <div class="right-tags">
              <span v-if="actor.likeCount > 0" class="like-count">♥ {{ actor.likeCount }}</span>
              <span v-if="actor.videoCount > 0" class="video-count">{{ actor.videoCount }} 部</span>
              <span v-if="actor.country" class="country-tag">{{ actor.country }}</span>
            </div>
          </div>
          <!-- 第二行：简介（灰色小字，单行溢出省略号） -->
          <div class="info-row bio-row" v-if="actor.bio">
            <span class="bio">{{ actor.bio }}</span>
          </div>
        </div>
        <!-- 第三行：CardActions -->
        <CardActions>
          <button class="btn btn-primary" @click.stop="handleEdit(actor)">编辑</button>
          <button class="btn btn-success" @click.stop="goToDetail(actor.id)">详情</button>
        </CardActions>
      </div>
    </div>
    <div class="empty-hint" v-if="actors.length === 0 && !loading">暂无演员</div>
    <div class="pagination" v-if="total > pageSize">
      <button :disabled="page === 1" @click="changePage(page - 1)">上一页</button>
      <span>第 {{ page }} 页 / 共 {{ Math.ceil(total / pageSize) }} 页</span>
      <button :disabled="page * pageSize >= total" @click="changePage(page + 1)">下一页</button>
    </div>

    <!-- 使用 AddActorDialog 弹窗 -->
    <AddActorDialog
      :visible="showDialog"
      :editing-actor="editingActor"
      @save="handleSave"
      @cancel="handleCancel"
      @delete="handleDelete"
    />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { actorApi } from '@/scripts/api'
import CardActions from '@/views/components/CardActions.vue'
import AddActorDialog from '@/views/components/AddActorDialog.vue'

const router = useRouter()
const actors = ref([])
const keyword = ref('')
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)
const loading = ref(false)
const showDialog = ref(false)
const editingActor = ref(null)

onMounted(() => {
  loadActors()
})

const loadActors = async () => {
  loading.value = true
  try {
    const params = {
      page: page.value,
      pageSize: pageSize.value
    }
    if (keyword.value) params.keyword = keyword.value

    const res = await actorApi.getList(params)
    if (res.success) {
      actors.value = res.data || []
      total.value = res.total || 0
    }
  } catch (error) {
    console.error('加载演员失败:', error)
  } finally {
    loading.value = false
  }
}

const changePage = (newPage) => {
  page.value = newPage
  loadActors()
}

const goToDetail = (id) => {
  router.push(`/actor/${id}`)
}

const handleAdd = () => {
  editingActor.value = null
  showDialog.value = true
}

const handleEdit = (actor) => {
  editingActor.value = actor
  showDialog.value = true
}

const handleSave = async () => {
  showDialog.value = false
  editingActor.value = null
  await loadActors()
}

const handleCancel = () => {
  showDialog.value = false
  editingActor.value = null
}

const handleDelete = async () => {
  showDialog.value = false
  editingActor.value = null
  await loadActors()
}
</script>

<style scoped>
.actor-list {
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
  display: flex;
  gap: 8px;
  margin-bottom: 20px;
}

.search-input {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  width: 200px;
}

.search-btn {
  padding: 8px 16px;
  background: #3498db;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.search-btn:hover {
  background: #2980b9;
}

.actor-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
  margin-bottom: 30px;
}

.actor-card {
  cursor: pointer;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition: box-shadow 0.3s;
  background: #fff;
  display: flex;
  flex-direction: column;
}

.actor-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
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

/* 第一行：姓名 */
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

/* 第二行：简介（单行溢出省略号） */
.bio-row {
  overflow: hidden;
}

.bio-row .bio {
  font-size: 13px;
  color: #999;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: block;
}

.empty-hint {
  color: #999;
  font-size: 14px;
  padding: 40px;
  text-align: center;
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
