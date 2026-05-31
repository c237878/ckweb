<template>
  <div class="actor-list">
    <div class="list-header">
      <h1>演员列表</h1>
      <button class="add-btn" @click="showAddDialog = true">添加演员</button>
    </div>
    <div class="filters">
      <select v-model="filters.country" @change="loadActors">
        <option value="">全部类型</option>
        <option v-for="country in existingCountries" :key="country" :value="country">
          {{ country }}
        </option>
      </select>
    </div>
    <div class="actor-grid">
      <div class="actor-card" v-for="actor in actors" :key="actor.id">
        <div class="actor-info" @click="goToDetail(actor.id)">
          <div class="actor-row1">
            <span class="actor-name">{{ actor.name }}</span>
            <span class="actor-type">{{ actor.country || '未设置' }}</span>
          </div>
          <div class="actor-row2">
            <span v-if="actor.alias" class="actor-alias">{{ actor.alias }}</span>
            <span class="actor-count">{{ actor.videoCount || 0 }} 部影片</span>
          </div>
        </div>
        <div class="actor-actions">
          <button class="edit-btn" @click.stop="handleEditActor(actor)">编辑</button>
        </div>
      </div>
    </div>
    <div class="pagination" v-if="total > pageSize">
      <button :disabled="page === 1" @click="changePage(page - 1)">上一页</button>
      <span>第 {{ page }} 页</span>
      <button :disabled="page * pageSize >= total" @click="changePage(page + 1)">下一页</button>
    </div>

    <AddActorDialog
      :visible="showAddDialog"
      :editing-actor="editingActor"
      @save="handleSaveActor"
      @cancel="showAddDialog = false; editingActor = null"
      @delete="handleDeleteActor"
    />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { actorApi } from '@/scripts/api'
import AddActorDialog from '@/views/components/AddActorDialog.vue'

const router = useRouter()
const actors = ref([])
const existingCountries = ref([])
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)
const filters = ref({
  country: ''
})
const showAddDialog = ref(false)
const editingActor = ref(null)

onMounted(async () => {
  await Promise.all([
    loadActors(),
    loadExistingCountries()
  ])
})

const loadActors = async () => {
  try {
    const params = {
      page: page.value,
      pageSize: pageSize.value
    }
    if (filters.value.country) params.country = filters.value.country

    const res = await actorApi.getList(params)
    if (res.success) {
      actors.value = res.data
      total.value = res.total
    }
  } catch (error) {
    console.error('加载演员失败:', error)
  }
}

const loadExistingCountries = async () => {
  try {
    const res = await actorApi.getList({ page: 1, pageSize: 1000 })
    if (res.success && res.data) {
      const countries = new Set()
      res.data.forEach(actor => {
        if (actor.country) countries.add(actor.country)
      })
      existingCountries.value = Array.from(countries)
    }
  } catch (error) {
    console.error('加载类型列表失败:', error)
  }
}

const changePage = (newPage) => {
  page.value = newPage
  loadActors()
}

const goToDetail = (id) => {
  router.push(`/actor/${id}`)
}

const handleEditActor = (actor) => {
  editingActor.value = actor
  showAddDialog.value = true
}

const handleDeleteActor = async (actorId) => {
  try {
    const res = await actorApi.delete(actorId)
    if (res.success) {
      showAddDialog.value = false
      editingActor.value = null
      alert('删除成功！')
      await loadActors()
    } else {
      alert('删除失败：' + res.message)
    }
  } catch (error) {
    console.error('删除演员失败:', error)
    alert('删除失败：' + error.message)
  }
}

const handleSaveActor = async (actorData) => {
  try {
    let res
    if (editingActor.value) {
      res = await actorApi.update(editingActor.value.id, actorData)
    } else {
      res = await actorApi.add(actorData)
    }

    if (res.success) {
      showAddDialog.value = false
      editingActor.value = null
      await loadActors()
      alert(editingActor.value ? '更新成功！' : '添加成功！')
    } else {
      alert('操作失败：' + res.message)
    }
  } catch (error) {
    console.error('保存演员失败:', error)
    alert('操作失败：' + error.message)
  }
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

.filters {
  margin-bottom: 30px;
}

.filters select {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.actor-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
}

.actor-card {
  cursor: pointer;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition: transform 0.3s;
  background: #fff;
  display: flex;
  flex-direction: column;
}

.actor-card:hover {
  transform: translateY(-5px);
}

.actor-info {
  padding: 15px 20px;
  flex: 1;
}

.actor-row1 {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.actor-name {
  font-size: 16px;
  font-weight: bold;
}

.actor-type {
  color: #3498db;
  font-size: 12px;
  background: #ebf5fb;
  padding: 2px 8px;
  border-radius: 10px;
}

.actor-row2 {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.actor-alias {
  color: #999;
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  margin-right: 10px;
}

.actor-count {
  color: #e74c3c;
  font-size: 12px;
  font-weight: bold;
  white-space: nowrap;
}

.actor-actions {
  padding: 10px 15px;
  border-top: 1px solid #f0f0f0;
  display: flex;
  justify-content: flex-end;
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
