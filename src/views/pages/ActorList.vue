<template>
  <div class="actor-list">
    <div class="list-header">
      <h1>演员列表</h1>
      <div class="header-actions">
        <label class="select-all">
          <input type="checkbox" :checked="isAllSelected" @change="toggleSelectAll" />
          全选
        </label>
        <button v-if="selectedIds.length > 0" class="batch-delete-btn" @click="batchDelete">
          批量删除 ({{ selectedIds.length }})
        </button>
        <button class="add-btn" @click="handleAdd">添加演员</button>
      </div>
    </div>

    <div class="filters">
      <select v-model="filters.country" @change="page = 1; loadActors()">
        <option value="">全部地区</option>
        <option v-for="c in countries" :key="c" :value="c">{{ c }}</option>
      </select>
      <input
        v-model="keyword"
        placeholder="搜索演员..."
        type="text"
        @keyup.enter="loadActors"
      />
      <button class="search-btn" @click="loadActors">搜索</button>
    </div>

    <div class="actor-grid">
      <div
        class="actor-card"
        v-for="actor in actors"
        :key="actor.id"
        :class="{ selected: selectedIds.includes(actor.id) }"
      >
        <div class="card-main">
          <div class="card-checkbox-col">
            <input
              type="checkbox"
              class="card-checkbox"
              :checked="selectedIds.includes(actor.id)"
              @change="handleSelect(actor)"
              @click.stop
            />
          </div>
          <div class="card-body" @click="handleSelect(actor)">
            <div class="info-row">
              <span class="name">{{ actor.name }}</span>
              <div class="right-tags">
                  <span v-if="actor.country" class="country-tag">{{ actor.country }}</span>
                  <span v-if="actor.likeCount > 0" class="like-count">♥ {{ actor.likeCount }}</span>
                  <span v-if="actor.videoCount > 0" class="video-count">{{ actor.videoCount }} 部</span>
                </div>
            </div>
            <div class="info-row bio-row" v-if="actor.bio">
              <span class="bio">{{ actor.bio }}</span>
            </div>
          </div>
        </div>
        <CardActions>
          <button class="btn btn-primary" @click.stop="handleEdit(actor)">编辑</button>
          <button class="btn btn-success" @click.stop="goToDetail(actor.id)">详情</button>
        </CardActions>
      </div>
    </div>

    <div class="empty-hint" v-if="actors.length === 0 && !loading">暂无演员</div>

    <div class="pagination" v-if="total > 0">
      <button :disabled="page === 1" @click="changePage(page - 1)">上一页</button>
      <span>第 {{ page }} 页 / 共 {{ Math.ceil(total / pageSize) }} 页（共 {{ total }} 条）</span>
      <button :disabled="page * pageSize >= total" @click="changePage(page + 1)">下一页</button>
    </div>

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
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { actorApi, settingApi } from '@/scripts/api'
import CardActions from '@/views/components/CardActions.vue'
import AddActorDialog from '@/views/components/AddActorDialog.vue'

const router = useRouter()
const actors = ref([])
const keyword = ref('')
const page = ref(1)
const pageSize = ref(24)
const total = ref(0)
const loading = ref(false)
const showDialog = ref(false)
const editingActor = ref(null)
const countries = ref([])
const filters = ref({ country: '' })
const selectedIds = ref([])

const isAllSelected = computed(() => {
  return actors.value.length > 0 && selectedIds.value.length === actors.value.length
})

const toggleSelectAll = () => {
  if (isAllSelected.value) {
    selectedIds.value = []
  } else {
    selectedIds.value = actors.value.map(a => a.id)
  }
}

const handleSelect = (actor) => {
  const idx = selectedIds.value.indexOf(actor.id)
  if (idx > -1) {
    selectedIds.value.splice(idx, 1)
  } else {
    selectedIds.value.push(actor.id)
  }
}

const batchDelete = async () => {
  if (!confirm(`确定要删除选中的 ${selectedIds.value.length} 个演员吗？`)) return
  try {
    for (const id of selectedIds.value) {
      await actorApi.delete(id)
    }
    selectedIds.value = []
    await loadActors()
  } catch (error) {
    console.error('批量删除失败:', error)
    alert('批量删除失败：' + error.message)
  }
}

const loadActors = async () => {
  loading.value = true
  try {
    const params = {
      page: page.value,
      pageSize: pageSize.value,
      keyword: keyword.value
    }
    if (filters.value.country) params.country = filters.value.country

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

const handleSave = async (formData) => {
  try {
    if (formData.id) {
      await actorApi.update(formData.id, formData)
    } else {
      await actorApi.add(formData)
    }
  } catch (error) {
    alert('保存失败：' + (error.message || error))
    return
  }
  showDialog.value = false
  editingActor.value = null
  await loadActors()
}

const handleCancel = () => {
  showDialog.value = false
  editingActor.value = null
}

const handleDelete = async (id) => {
  if (!confirm('确定要删除该演员吗？')) return
  try {
    await actorApi.delete(id || editingActor.value?.id)
    showDialog.value = false
    editingActor.value = null
    await loadActors()
  } catch (error) {
    alert('删除失败：' + (error.message || error))
  }
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
    const metaRes = await actorApi.getList({ page: 1, pageSize: 1000 })
    if (metaRes.success && metaRes.data) {
      const unique = new Set()
      metaRes.data.forEach(a => { if (a.country) unique.add(a.country) })
      countries.value = Array.from(unique).sort()
    }
  } catch (e) {
    console.warn('加载地区列表失败', e)
  }
  await loadActors()
})
</script>

<style scoped>
.actor-list {
  padding: 20px 0;
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
  margin: 0;
  font-size: 28px;
  color: #333;
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
  margin-bottom: 20px;
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  align-items: center;
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

.actor-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
  margin-bottom: 30px;
}

.actor-card {
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition: box-shadow 0.3s, border 0.2s, background 0.2s;
  background: #fff;
  display: flex;
  flex-direction: column;
  align-items: stretch;
}

.actor-card.selected {
  background: #e3f2fd;
  border: 2px solid #2196f3;
}

.actor-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
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
</style>
