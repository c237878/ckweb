<template>
  <div class="page comic-list">
    <div class="page-header">
      <h1 class="page-title">漫画管理</h1>
      <button class="btn btn--primary" @click="handleAdd">添加漫画</button>
    </div>

    <div class="filters">
      <SelectList
        v-model="statusFilter"
        :options="STATUS_OPTIONS"
        label="按连载状态筛选"
        @change="applyFilter"
      />
      <SelectList
        v-model="sortBy"
        :options="SORT_OPTIONS.comic"
        label="排序方式"
        @change="applyFilter"
      />
      <input
        v-model="keyword"
        class="input grow"
        type="search"
        placeholder="搜索漫画名称或作者..."
        aria-label="搜索漫画名称或作者"
        @keyup.enter="applyFilter"
        @input="debouncedSearch"
      />
      <button class="btn btn--sm btn--ghost" @click="handleReset">重置</button>
    </div>

    <div v-if="loading" class="grid" aria-busy="true" aria-label="加载中">
      <div v-for="n in Math.min(pageSize, 24)" :key="n" class="skeleton card-skeleton"></div>
    </div>

    <div v-else-if="error" class="notice notice--error">{{ error }}</div>

    <div v-else-if="comicList.length" class="grid">
      <ComicCard
        v-for="comic in comicList"
        :key="comic.id"
        :comic="comic"
        @click="goToDetail"
        @edit="handleEdit"
        @delete="handleDelete"
      />
    </div>

    <div v-else class="empty">
      <p>{{ hasFilter ? '没有符合条件的漫画' : '暂无漫画，点击上方「添加漫画」开始' }}</p>
      <button v-if="hasFilter" class="btn btn--sm" @click="handleReset">清除筛选</button>
    </div>

    <Pagination v-model:page="page" :page-size="pageSize" :total="total" @change="loadComics" />

    <!-- 添加/编辑对话框 -->
    <ComicFormDialog
      :visible="showDialog"
      :editing-comic="editingComic"
      :saving="saving"
      @update:visible="showDialog = $event"
      @save="handleSave"
      @cancel="handleCancel"
    />
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { comicApi } from '@/scripts/api'
import { useAppStore } from '@/scripts/store/app'
import { useUiStore, errText } from '@/scripts/store/ui'
import { SORT_OPTIONS, COMIC_STATUS_OPTIONS } from '@/scripts/constants'
import { debounce } from '@/scripts/utils/debounce'
import { loadFilterState, saveFilterState } from '@/scripts/utils/filterPersist'
import ComicCard from '@/views/components/ComicCard.vue'
import ComicFormDialog from '@/views/components/ComicFormDialog.vue'
import Pagination from '@/views/components/Pagination.vue'
import SelectList from '@/views/components/SelectList.vue'

const router = useRouter()
const app = useAppStore()
const ui = useUiStore()
const STORAGE_KEY = 'comic-list'

const comicList = ref([])
const page = ref(1)
const total = ref(0)
const keyword = ref('')
// 全部状态用 -1 占位，服务端没有这个值，过滤时当作"不限"
const STATUS_OPTIONS = [{ value: -1, label: '全部状态' }, ...COMIC_STATUS_OPTIONS]

const statusFilter = ref(-1)
const sortBy = ref('')
const loading = ref(true)
const error = ref('')
const showDialog = ref(false)
const editingComic = ref(null)
const saving = ref(false)

// 每页条数跟随站点设置，不再各页各写一个数
const pageSize = computed(() => app.pageSize)

const hasFilter = computed(() => !!keyword.value || statusFilter.value >= 0 || !!sortBy.value)

// 筛选状态持久化（keyword 不缓存）
watch([statusFilter, sortBy, page], () => {
  saveFilterState(STORAGE_KEY, { statusFilter: statusFilter.value, sortBy: sortBy.value, page: page.value })
})

const loadComics = async () => {
  loading.value = true
  error.value = ''
  try {
    const params = { pageIndex: page.value, pageSize: pageSize.value }
    if (keyword.value) params.keyword = keyword.value
    if (statusFilter.value >= 0) params.status = statusFilter.value
    if (sortBy.value) params.sortBy = sortBy.value
    const res = await comicApi.getList(params)
    if (res.success) {
      comicList.value = res.data?.list || []
      total.value = res.data?.total || 0
    } else {
      error.value = res.message || '漫画加载失败'
    }
  } catch (err) {
    console.error('加载漫画失败:', err)
    error.value = '漫画加载失败，请确认后端服务可用'
  } finally {
    loading.value = false
  }
}

const applyFilter = () => {
  page.value = 1
  loadComics()
}

// 停顿 400ms 再查，避免每敲一个字打一次接口
const debouncedSearch = debounce(applyFilter, 400)

// 重置筛选
const handleReset = () => {
  debouncedSearch.cancel()
  keyword.value = ''
  statusFilter.value = -1
  sortBy.value = ''
  applyFilter()
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
  if (saving.value) return
  saving.value = true
  try {
    if (editingComic.value?.id) {
      await comicApi.update(editingComic.value.id, form)
    } else {
      await comicApi.add(form)
    }
  } catch (err) {
    ui.error('保存失败：' + errText(err))
    return
  } finally {
    saving.value = false
  }
  showDialog.value = false
  editingComic.value = null
  await loadComics()
  ui.success('已保存')
}

const handleDelete = async (comic) => {
  if (!await ui.confirm({
    title: '确认删除',
    message: `确定要删除漫画「${comic.name}」吗？删除后不可恢复。`,
    danger: true
  })) return
  try {
    await comicApi.delete(comic.id)
    await loadComics()
    ui.success('已删除')
  } catch (err) {
    ui.error('删除失败：' + errText(err))
  }
}

onMounted(async () => {
  const saved = loadFilterState(STORAGE_KEY)
  if (saved) {
    statusFilter.value = saved.statusFilter ?? -1
    sortBy.value = saved.sortBy ?? ''
    page.value = saved.page ?? 1
  }
  await app.init()
  await loadComics()
})
</script>

<style scoped>
.comic-list {
  display: flex;
  flex-direction: column;
  gap: var(--s4);
}

/* 封面 3:2 再加约三行文字与操作栏的高度 */
.card-skeleton {
  aspect-ratio: 1 / 1.15;
  border-radius: var(--r2);
}
</style>
