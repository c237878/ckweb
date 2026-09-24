<template>
  <div class="page video-list">
    <div class="page-header">
      <h1 class="page-title">影片列表</h1>
      <div class="header-actions">
        <template v-if="mode === 'browse'">
          <button class="btn btn--sm" :disabled="renaming" @click="checkAndRename">
            {{ renaming ? '检查中...' : '校验文件名' }}
          </button>
          <button class="btn btn--sm" @click="openAdd">添加</button>
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
      <SelectList
        v-model="filters.category"
        :options="categories"
        all-label="全部分类"
        label="按分类筛选"
        @change="applyFilter"
      />
      <SelectList
        v-model="filters.downloaded"
        :options="DOWNLOAD_OPTIONS"
        all-label="全部状态"
        label="按下载状态筛选"
        @change="applyFilter"
      />
      <SelectList
        v-model="filters.mediaAttrFlags"
        :options="mediaFlagOptions"
        all-label="全部片源"
        label="按片源筛选"
        @change="applyFilter"
      />
      <ComboBox
        v-model="filters.seriesId"
        :options="seriesList"
        placeholder="筛选系列..."
        all-label="全部系列"
        @change="applyFilter"
      />
      <input
        v-model="filters.keyword"
        class="input grow"
        type="search"
        placeholder="搜索影片名称或番号..."
        @keyup.enter="applyFilter"
        @input="debouncedSearch"
      />
      <SelectList
        v-model="filters.sortBy"
        :options="SORT_OPTIONS.video"
        label="排序方式"
        @change="applyFilter"
      />
      <button class="btn btn--sm btn--ghost" @click="handleReset">重置</button>
    </div>

    <div v-if="loading" class="grid" aria-busy="true" aria-label="加载中">
      <div v-for="n in Math.min(pageSize, 24)" :key="n" class="skeleton card-skeleton"></div>
    </div>

    <div v-else-if="error" class="notice notice--error">{{ error }}</div>

    <div v-else-if="videos.length" class="grid">
      <VideoCard
        v-for="video in videos"
        :key="video.id"
        :video="video"
        :click-action="cardClickAction"
        :selectable="mode === 'select'"
        :selected="selectedIds.includes(video.id)"
        @select="handleSelectVideo"
        @pick="handlePick"
      />
    </div>

    <div v-else class="empty">
      <p>没有符合条件的影片</p>
      <button v-if="hasActiveFilter" class="btn btn--sm" @click="handleReset">清除筛选</button>
    </div>

    <Pagination v-model:page="page" :page-size="pageSize" :total="total" @change="loadVideos" />

    <AddVideoDialog
      :visible="showAddDialog"
      :editing-video="editingVideo"
      @save="handleSaveVideo"
      @save-continue="handleSaveContinue"
      @cancel="showAddDialog = false; editingVideo = null"
      @delete="handleDeleteVideo"
    />

    <!-- 校验文件名结果：原先塞在一个 alert 里显示 20 行文本 -->
    <div v-if="renameResult" class="overlay" @click.self="renameResult = null">
      <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="rename-title">
        <div class="dialog__head">
          <h3 class="dialog__title" id="rename-title">校验文件名</h3>
          <button class="dialog__close" aria-label="关闭" @click="renameResult = null">&times;</button>
        </div>
        <div class="dialog__body">
          <p class="summary">
            重命名 {{ renameResult.renamed }} 条 · 跳过 {{ renameResult.skipped }} 条 · 失败 {{ renameResult.failed }} 条
          </p>
          <ul class="detail-list">
            <li v-for="(item, i) in renameResult.details" :key="i" :class="{ failed: item.errors?.length }">
              <strong>{{ item.code }}</strong>
              <span v-if="item.errors?.length">{{ item.errors.join('；') }}</span>
              <span v-else-if="item.fileRenamed || item.coverRenamed">
                <template v-if="item.fileRenamed">{{ baseName(item.oldFile) }} → {{ baseName(item.newFile) }}</template>
                <template v-if="item.coverRenamed"> / {{ baseName(item.oldCover) }} → {{ baseName(item.newCover) }}</template>
              </span>
              <span v-else>无需调整</span>
            </li>
          </ul>
        </div>
        <div class="dialog__foot">
          <button class="btn btn--primary" @click="renameResult = null">知道了</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { videoApi } from '@/scripts/api'
import { useAppStore } from '@/scripts/store/app'
import { useUiStore, errText } from '@/scripts/store/ui'
import { MEDIA_FLAGS, SORT_OPTIONS } from '@/scripts/constants'
import { debounce } from '@/scripts/utils/debounce'
import VideoCard from '@/views/components/VideoCard.vue'
import AddVideoDialog from '@/views/components/AddVideoDialog.vue'
import Pagination from '@/views/components/Pagination.vue'
import ComboBox from '@/views/components/ComboBox.vue'
import SelectList from '@/views/components/SelectList.vue'
import { loadFilterState, saveFilterState } from '@/scripts/utils/filterPersist'

const STORAGE_KEY = 'video-list'

const DOWNLOAD_OPTIONS = [
  { value: 'yes', label: '已下载' },
  { value: 'no', label: '未下载' }
]

const app = useAppStore()
const ui = useUiStore()

const videos = ref([])
const page = ref(1)
const total = ref(0)
const categories = ref([])
const countries = ref([])
const seriesList = ref([])
const loading = ref(true)
const error = ref('')
const renaming = ref(false)
const renameResult = ref(null)
const showAddDialog = ref(false)
const editingVideo = ref(null)
const selectedIds = ref([])

const filters = ref({
  sortBy: '',
  category: '',
  country: '',
  seriesId: '',
  keyword: '',
  downloaded: '',
  mediaAttrFlags: ''
})

const pageSize = computed(() => app.pageSize)

// 0 是"未标记"，不作为筛选项（"全部片源"已覆盖）
const mediaFlagOptions = computed(() =>
  Object.entries(MEDIA_FLAGS)
    .filter(([value]) => value !== '0')
    .map(([value, flag]) => ({ value, label: flag.long }))
)

const hasActiveFilter = computed(() =>
  Object.values(filters.value).some((v) => v !== '' && v !== null)
)

const isAllSelected = computed(
  () => videos.value.length > 0 && selectedIds.value.length === videos.value.length
)

// 筛选状态持久化；关键词不存，否则下次进来仍是半截搜索
watch(
  [filters, page],
  () => saveFilterState(STORAGE_KEY, {
    filters: { ...filters.value, keyword: '' },
    page: page.value
  }),
  { deep: true }
)

onMounted(async () => {
  const saved = loadFilterState(STORAGE_KEY)
  if (saved?.filters) filters.value = { ...filters.value, ...saved.filters, keyword: '' }
  if (saved?.page) page.value = saved.page

  await app.init()
  await Promise.all([loadMeta(), loadVideos()])
})

const loadMeta = async () => {
  try {
    const res = await videoApi.getMeta()
    if (res.success) {
      categories.value = res.categories || []
      countries.value = res.countries || []
      seriesList.value = res.series || []
    }
  } catch (err) {
    console.error('加载元数据失败:', err)
  }
}

const loadVideos = async () => {
  loading.value = true
  error.value = ''
  try {
    const params = { pageIndex: page.value, pageSize: pageSize.value }
    if (filters.value.category) params.category = filters.value.category
    if (filters.value.country) params.country = filters.value.country
    if (filters.value.seriesId) params.seriesId = filters.value.seriesId
    if (filters.value.keyword) params.keyword = filters.value.keyword
    if (filters.value.downloaded === 'yes') params.hasFile = true
    else if (filters.value.downloaded === 'no') params.hasFile = false
    if (filters.value.mediaAttrFlags !== '') params.mediaAttrFlags = parseInt(filters.value.mediaAttrFlags)
    if (filters.value.sortBy) params.sortBy = filters.value.sortBy

    const res = await videoApi.getList(params)
    if (res.success) {
      videos.value = res.data.list || []
      total.value = res.data.total || 0
      // 列表内容换了，跨页保留的勾选会让"批量删除"作用在看不见的行上
      selectedIds.value = []
    } else {
      error.value = res.message || '影片加载失败'
    }
  } catch (err) {
    console.error('加载影片失败:', err)
    error.value = '影片加载失败，请确认后端服务可用'
  } finally {
    loading.value = false
  }
}

const applyFilter = () => {
  page.value = 1
  loadVideos()
}

// 停顿 400ms 再查，避免每敲一个字打一次接口
const debouncedSearch = debounce(applyFilter, 400)

const toggleSelectAll = () => {
  selectedIds.value = isAllSelected.value ? [] : videos.value.map((v) => v.id)
}

/** browse = 点卡片进详情；select = 勾选批量删；edit = 点一张开一个编辑框 */
const mode = ref('browse')

const cardClickAction = computed(() => (mode.value === 'edit' ? 'pick' : mode.value))

const enterMode = (next) => {
  mode.value = next
  selectedIds.value = []
}

const exitMode = () => {
  mode.value = 'browse'
  selectedIds.value = []
}

const handlePick = (video) => {
  editingVideo.value = video
  showAddDialog.value = true
}

const handleSelectVideo = (videoId) => {
  const index = selectedIds.value.indexOf(videoId)
  if (index > -1) selectedIds.value.splice(index, 1)
  else selectedIds.value.push(videoId)
}

const handleReset = () => {
  filters.value = { country: '', category: '', seriesId: '', keyword: '', downloaded: '', mediaAttrFlags: '', sortBy: '' }
  applyFilter()
}

const openAdd = () => {
  editingVideo.value = null
  showAddDialog.value = true
}

const baseName = (path) => (path || '').split('/').pop()

// 删除是破坏性操作，统一走全局确认队列；需要"仅删记录/连文件一起删"两种结果，
// 所以用 ask 而不是 confirm。
const askDeleteChoice = (label) =>
  ui.ask({
    title: '确认删除',
    message: `删除后不可恢复。${label}磁盘上的视频文件要一起删掉吗？`,
    actions: [
      { value: 'deleteRecordOnly', label: '仅删记录' },
      { value: 'deleteAll', label: '删除记录和文件', danger: true }
    ]
  })

const checkAndRename = async () => {
  if (renaming.value) return
  const go = await ui.confirm({
    title: '校验文件名',
    message: '将检查所有影片的视频/封面文件名是否与番号一致，不一致的自动重命名。是否继续？',
    confirmLabel: '开始检查'
  })
  if (!go) return

  renaming.value = true
  try {
    const res = await videoApi.renameToCode()
    if (res.success) {
      renameResult.value = res.data
      await loadVideos()
    } else {
      ui.error('检查失败：' + errText(res, '未知错误'))
    }
  } catch (err) {
    console.error('校验文件名失败:', err)
    ui.error('检查失败：' + errText(err))
  } finally {
    renaming.value = false
  }
}

const batchDelete = async () => {
  const choice = await askDeleteChoice(`选中的 ${selectedIds.value.length} 部影片将一并删除。`)
  if (choice === 'cancel') return
  try {
    await videoApi.batchDelete(selectedIds.value, { deleteFiles: choice === 'deleteAll' })
    exitMode()
    await loadVideos()
    ui.success('已删除')
  } catch (err) {
    console.error('批量删除失败:', err)
    ui.error('批量删除失败：' + errText(err))
  }
}

const handleSaveVideo = async (formData) => {
  try {
    if (formData.id) await videoApi.update(formData.id, formData)
    else await videoApi.add(formData)
    showAddDialog.value = false
    editingVideo.value = null
    await Promise.all([loadVideos(), loadMeta()])
    ui.success('已保存')
  } catch (err) {
    console.error('保存失败:', err)
    ui.error('保存失败：' + errText(err))
  }
}

const handleSaveContinue = async (formData) => {
  try {
    await videoApi.add(formData)
    await Promise.all([loadVideos(), loadMeta()])
    ui.success('已添加')
  } catch (err) {
    console.error('保存失败:', err)
    ui.error('保存失败：' + errText(err))
  }
}

const handleDeleteVideo = async (videoId) => {
  const name = editingVideo.value?.name
  const choice = await askDeleteChoice(name ? `「${name}」` : '')
  if (choice === 'cancel') return
  try {
    await videoApi.delete(videoId, { deleteFiles: choice === 'deleteAll' })
    showAddDialog.value = false
    editingVideo.value = null
    await loadVideos()
    ui.success('已删除')
  } catch (err) {
    console.error('删除失败:', err)
    ui.error('删除失败：' + errText(err))
  }
}
</script>

<style scoped>
.video-list {
  display: flex;
  flex-direction: column;
  gap: var(--s4);
}

/* 封面 3:2 再加约三行文字的高度 */
.card-skeleton {
  aspect-ratio: 1 / 1.08;
  border-radius: var(--r2);
}

.summary {
  color: var(--text-dim);
  font-size: var(--f-sm);
}

.detail-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 46vh;
  overflow-y: auto;
  font-size: var(--f-sm);
}

.detail-list li {
  display: flex;
  gap: var(--s2);
  padding: 5px 8px;
  border-radius: var(--r1);
  background: var(--bg-elev-2);
  color: var(--text-dim);
}

.detail-list li strong {
  color: var(--accent);
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
}

.detail-list li.failed {
  background: var(--danger-soft);
}

.detail-list li.failed strong {
  color: var(--danger);
}
</style>
