<template>
  <div class="page actor-list">
    <div class="page-header">
      <h1 class="page-title">演员列表</h1>
      <div class="header-actions">
        <template v-if="mode === 'browse'">
          <button class="btn btn--primary" @click="handleAdd">添加演员</button>
          <button class="btn btn--sm" @click="enterMode('select')">删除</button>
          <button class="btn btn--sm" @click="enterMode('edit')">编辑</button>
        </template>

        <template v-else-if="mode === 'select'">
          <label class="select-all">
            <input type="checkbox" :checked="isAllSelected" @change="toggleSelectAll" />
            全选
          </label>
          <button class="btn btn--sm btn--danger" :disabled="!selectedIds.length" @click="batchDelete">
            删除选中 ({{ selectedIds.length }})
          </button>
          <button class="btn btn--sm btn--ghost" @click="exitMode">取消</button>
        </template>

        <template v-else>
          <span class="mode-hint">点一张卡片进入编辑</span>
          <button class="btn btn--sm btn--ghost" @click="exitMode">退出编辑</button>
        </template>
      </div>
    </div>

    <div class="filters">
      <SelectList
        v-model="filters.country"
        :options="countries"
        all-label="全部地区"
        label="按地区筛选"
        @change="applyFilter"
      />
      <input
        v-model="keyword"
        class="input grow"
        type="search"
        placeholder="搜索演员姓名或别名..."
        @keyup.enter="applyFilter"
        @input="debouncedSearch"
      />
      <SelectList
        v-model="filters.sortBy"
        :options="SORT_OPTIONS.actor"
        label="排序方式"
        @change="applyFilter"
      />
      <button class="btn btn--sm btn--ghost" @click="handleReset">重置</button>
    </div>

    <div v-if="loading" class="grid" aria-busy="true" aria-label="加载中">
      <div v-for="n in Math.min(pageSize, 24)" :key="n" class="skeleton row-skeleton"></div>
    </div>

    <div v-else-if="error" class="notice notice--error">{{ error }}</div>

    <div v-else-if="actors.length" class="grid">
      <ActorCard
        v-for="actor in actors"
        :key="actor.id"
        :actor="actor"
        :click-action="cardClickAction"
        :selectable="mode === 'select'"
        :selected="selectedIds.includes(actor.id)"
        @select="handleSelect"
        @pick="handleEdit"
      />
    </div>

    <div v-else class="empty">
      <p>没有符合条件的演员</p>
      <button v-if="hasActiveFilter" class="btn btn--sm" @click="handleReset">清除筛选</button>
    </div>

    <Pagination v-model:page="page" :page-size="pageSize" :total="total" @change="loadActors" />

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
import { ref, onMounted, computed, watch } from 'vue'
import { actorApi } from '@/scripts/api'
import { useAppStore } from '@/scripts/store/app'
import { useUiStore, errText } from '@/scripts/store/ui'
import { SORT_OPTIONS } from '@/scripts/constants'
import { debounce } from '@/scripts/utils/debounce'
import AddActorDialog from '@/views/components/AddActorDialog.vue'
import ActorCard from '@/views/components/ActorCard.vue'
import Pagination from '@/views/components/Pagination.vue'
import SelectList from '@/views/components/SelectList.vue'
import { loadFilterState, saveFilterState } from '@/scripts/utils/filterPersist'

const STORAGE_KEY = 'actor-list'

const app = useAppStore()
const ui = useUiStore()

const actors = ref([])
const keyword = ref('')
const page = ref(1)
const total = ref(0)
const countries = ref([])
const loading = ref(true)
const error = ref('')
const showDialog = ref(false)
const editingActor = ref(null)
const selectedIds = ref([])

const filters = ref({ country: '', sortBy: '' })

const pageSize = computed(() => app.pageSize)

// 关键词单独不入库：下次进来仍是半截搜索很烦
const hasActiveFilter = computed(
  () => keyword.value !== '' || Object.values(filters.value).some((v) => v !== '' && v !== null)
)

const isAllSelected = computed(
  () => actors.value.length > 0 && selectedIds.value.length === actors.value.length
)

watch(
  [filters, page],
  () => saveFilterState(STORAGE_KEY, { filters: filters.value, page: page.value }),
  { deep: true }
)

onMounted(async () => {
  const saved = loadFilterState(STORAGE_KEY)
  if (saved?.filters) filters.value = { ...filters.value, ...saved.filters }
  if (saved?.page) page.value = saved.page

  await app.init()
  // 旧版排序值是驼峰（likeCount），换成 constants 里的小写值，避免下拉框对不上
  if (filters.value.sortBy) filters.value.sortBy = String(filters.value.sortBy).toLowerCase()
  await Promise.all([loadCountries(), loadActors()])
})

const loadCountries = async () => {
  try {
    const res = await actorApi.getCountries()
    if (res.success && res.data) countries.value = res.data
  } catch (err) {
    console.warn('加载地区列表失败:', err)
  }
}

const loadActors = async () => {
  loading.value = true
  error.value = ''
  try {
    const params = {
      page: page.value,
      pageSize: pageSize.value,
      keyword: keyword.value
    }
    if (filters.value.country) params.country = filters.value.country
    if (filters.value.sortBy) params.sortBy = filters.value.sortBy

    const res = await actorApi.getList(params)
    if (res.success) {
      actors.value = res.data || []
      total.value = res.total || 0
      // 列表内容换了，跨页保留的勾选会让"批量删除"作用在看不见的行上
      selectedIds.value = []
    } else {
      error.value = res.message || '演员加载失败'
    }
  } catch (err) {
    console.error('加载演员失败:', err)
    error.value = '演员加载失败，请确认后端服务可用'
  } finally {
    loading.value = false
  }
}

const applyFilter = () => {
  page.value = 1
  loadActors()
}

// 停顿 400ms 再查，避免每敲一个字打一次接口
const debouncedSearch = debounce(applyFilter, 400)

const toggleSelectAll = () => {
  selectedIds.value = isAllSelected.value ? [] : actors.value.map((a) => a.id)
}

/** browse = 点卡片进详情；select = 勾选批量删；edit = 点一张开编辑框 */
const mode = ref('browse')

const enterMode = (next) => {
  mode.value = next
  selectedIds.value = []
}

const exitMode = () => {
  mode.value = 'browse'
  selectedIds.value = []
}

const cardClickAction = computed(() => (mode.value === 'edit' ? 'pick' : mode.value))

const handleSelect = (actor) => {
  const index = selectedIds.value.indexOf(actor.id)
  if (index > -1) selectedIds.value.splice(index, 1)
  else selectedIds.value.push(actor.id)
}

const handleReset = () => {
  keyword.value = ''
  filters.value = { country: '', sortBy: '' }
  applyFilter()
}

const handleAdd = () => {
  editingActor.value = null
  showDialog.value = true
}

const handleEdit = (actor) => {
  editingActor.value = actor
  showDialog.value = true
}

// 后端没有批量删除接口，只能逐条删：中途失败时前面那些已经真的删掉了，
// 所以要把成功/失败数量汇总成一条提示说清楚，而不是第一条失败就中断还只报一个错
const batchDelete = async () => {
  const ids = [...selectedIds.value]
  const go = await ui.confirm({
    title: '确认删除',
    message: `确定要删除选中的 ${ids.length} 个演员吗？`,
    danger: true
  })
  if (!go) return

  let done = 0
  const errors = []
  for (const id of ids) {
    try {
      await actorApi.delete(id)
      done += 1
    } catch (err) {
      console.error('批量删除失败:', err)
      errors.push(errText(err))
    }
  }
  exitMode()
  await loadActors()
  if (errors.length) {
    // 只报第一条原因：一屏同样的网络错误没有信息量
    ui.error(`批量删除：已删除 ${done} 项，失败 ${errors.length} 项（${errors[0]}）`)
  } else {
    ui.success(`已删除 ${done} 项`)
  }
}

const handleSave = async (formData) => {
  try {
    if (formData.id) {
      await actorApi.update(formData.id, formData)
    } else {
      await actorApi.add(formData)
    }
  } catch (err) {
    console.error('保存演员失败:', err)
    ui.error('保存失败：' + errText(err))
    return
  }
  showDialog.value = false
  editingActor.value = null
  await Promise.all([loadActors(), loadCountries()])
  ui.success('已保存')
}

const handleCancel = () => {
  showDialog.value = false
  editingActor.value = null
}

const handleDelete = async (id) => {
  const go = await ui.confirm({ title: '确认删除', message: '确定要删除该演员吗？', danger: true })
  if (!go) return
  try {
    await actorApi.delete(id || editingActor.value?.id)
    showDialog.value = false
    editingActor.value = null
    await Promise.all([loadActors(), loadCountries()])
    ui.success('已删除')
  } catch (err) {
    console.error('删除演员失败:', err)
    ui.error('删除失败：' + errText(err))
  }
}
</script>

<style scoped>
.actor-list {
  display: flex;
  flex-direction: column;
  gap: var(--s4);
}

.row-skeleton {
  height: calc(var(--s5) + var(--s4));
  border-radius: var(--r2);
}

.name {
  display: block;
  flex: 1 1 6em;
  min-width: 6em;
  font-size: var(--f-lg);
  font-weight: 600;
  color: var(--text);
}

.name-text {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: color var(--dur) var(--ease);
}

.name:hover .name-text {
  color: var(--accent);
}

/* 布局走全局 .pills，这里只负责把胶囊推到名称右侧 */
.right-tags {
  justify-content: flex-end;
  margin-left: auto;
}
</style>
