<template>
  <div class="page series-detail">
    <div v-if="loading" class="loading-block">
      <div class="skeleton head-skeleton"></div>
      <div class="grid" aria-busy="true" aria-label="加载中">
        <div v-for="n in Math.min(pageSize, 12)" :key="n" class="skeleton card-skeleton"></div>
      </div>
    </div>

    <div v-else-if="error" class="notice notice--error">
      {{ error }}
      <button class="btn btn--sm" @click="loadAll">重试</button>
    </div>

    <template v-else-if="series">
      <section class="panel series-header">
        <div class="page-header">
          <h1 class="page-title">{{ series.name }}</h1>
          <div class="header-actions">
            <button class="btn btn--sm" @click="openEditDialog">编辑</button>
            <template v-if="total > 1">
              <button v-if="!sorting" class="btn btn--sm" :disabled="videosLoading" @click="startSort">编辑排序</button>
              <template v-else>
                <button class="btn btn--sm btn--primary" :disabled="savingSort || videosLoading" @click="saveSort">
                  {{ savingSort ? '保存中...' : '完成排序' }}
                </button>
                <button class="btn btn--sm btn--ghost" :disabled="savingSort" @click="cancelSort">取消</button>
              </template>
            </template>
          </div>
        </div>

        <div v-if="series.country || series.likeCount > 0" class="tag-row">
          <span v-if="series.country" class="tag tag--accent">{{ series.country }}</span>
          <span v-if="series.likeCount > 0" class="tag tag--like">♥ {{ series.likeCount }}</span>
        </div>

        <p v-if="series.alias" class="alias-row">别名：{{ series.alias }}</p>
        <p v-if="series.link" class="link-row">
          链接：<a :href="series.link" target="_blank" rel="noopener noreferrer">{{ decodeUrl(series.link) }}</a>
        </p>
      </section>

      <p v-if="sorting" class="notice sort-hint">
        拖动影片卡片调整顺序，序号即系列内位置，完成后点「完成排序」保存。
      </p>

      <section>
        <div class="videos-head">
          <h2 class="section-title">系列影片 ({{ total }})</h2>
          <div class="media-filter">
            <SelectList
              v-model="sourceFilter.subtitle"
              :options="SUBTITLE_OPTIONS"
              all-label="全部字幕"
              label="按字幕情况筛选影片"
              :disabled="videosLoading"
            />
            <SelectList
              v-model="sourceFilter.watermark"
              :options="WATERMARK_OPTIONS"
              all-label="全部水印"
              label="按广告水印筛选影片"
              :disabled="videosLoading"
            />
            <SelectList
              v-model="sourceFilter.resolution"
              :options="RESOLUTION_OPTIONS"
              all-label="全部分辨率"
              label="按分辨率筛选影片"
              :disabled="videosLoading"
            />
          </div>
        </div>

        <div v-if="videosLoading" class="grid" aria-busy="true" aria-label="加载中">
          <div v-for="n in Math.min(pageSize, 24)" :key="n" class="skeleton card-skeleton"></div>
        </div>

        <div v-else-if="videosError" class="notice notice--error">{{ videosError }}</div>

        <div v-else-if="videos.length" class="grid" :class="{ 'grid-sorting': sorting }">
          <div
            v-for="(video, index) in videos"
            :key="video.id"
            class="video-slot"
            :class="{ dragging: dragIndex === index, 'drag-over': dragOverIndex === index }"
            :draggable="sorting"
            @dragstart="onDragStart($event, index)"
            @dragover.prevent="onDragOver($event, index)"
            @dragleave="onDragLeave(index)"
            @drop="onDrop($event, index)"
            @dragend="onDragEnd"
          >
            <div v-if="sorting" class="sort-badge">{{ index + 1 }}</div>
            <VideoCard :video="video" />
          </div>
        </div>

        <div v-else class="empty">
          <p>{{ hasSourceFilter ? '没有符合这个片源条件的影片' : '该系列暂无影片' }}</p>
          <button v-if="hasSourceFilter" class="btn btn--sm" @click="clearSourceFilter">清除筛选</button>
        </div>

        <Pagination
          v-if="!sorting"
          v-model:page="page"
          :page-size="pageSize"
          :total="total"
          @change="loadVideos"
        />
      </section>

      <AddSeriesDialog
        :visible="showEditDialog"
        :editing-series="series"
        @save="onEditSave"
        @cancel="showEditDialog = false"
        @delete="onDelete"
      />
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { seriesApi } from '@/scripts/api'
import { useAppStore } from '@/scripts/store/app'
import {
  isBlankFilter, rememberFilter, rememberedFilter, rememberedPage, rememberPage, sameFilter
} from '@/scripts/utils/browseMemory'
import { useUiStore, errText } from '@/scripts/store/ui'
import { SUBTITLE_OPTIONS, WATERMARK_OPTIONS, RESOLUTION_OPTIONS } from '@/scripts/constants'
import VideoCard from '@/views/components/VideoCard.vue'
import AddSeriesDialog from '@/views/components/AddSeriesDialog.vue'
import Pagination from '@/views/components/Pagination.vue'
import SelectList from '@/views/components/SelectList.vue'

const route = useRoute()
const router = useRouter()
const app = useAppStore()
const ui = useUiStore()

const series = ref(null)
const videos = ref([])
const page = ref(1)
const total = ref(0)

const loading = ref(true)
const error = ref('')
const videosLoading = ref(false)
const videosError = ref('')

// 片源三维筛选（都下沉到后端，"未标记"是一个真实筛选值而不是不排除）
const EMPTY_FILTER = { subtitle: '', watermark: '', resolution: '' }
const sourceFilter = ref({ ...EMPTY_FILTER })
const hasSourceFilter = computed(() => !isBlankFilter(sourceFilter.value))
// 已经空了就别再换引用：deep watcher 只看引用变没变，会因此多跑一次"回第一页重取"
const clearSourceFilter = () => {
  if (!hasSourceFilter.value) return
  sourceFilter.value = { ...EMPTY_FILTER }
}
// 切实体 / 进来时按这个系列自己记下的那一筛恢复；内容没变就别换引用
const applyRememberedFilter = () => {
  const saved = rememberedFilter(filterKey(), EMPTY_FILTER)
  if (sameFilter(saved, sourceFilter.value)) return
  sourceFilter.value = saved
}
const showEditDialog = ref(false)

// 排序相关
const sorting = ref(false)
const dragIndex = ref(null)
const dragOverIndex = ref(null)
const savingSort = ref(false)

const pageSize = computed(() => app.pageSize)

/**
 * 一个系列常有大几十部、好几页，每次进来都从第一页重筛等于把"我看到哪儿了"当没发生。
 * 与演员页共用 utils/browseMemory 那一份口径：只记非默认状态，越界页码由 loadVideos 收回。
 */
const pageKey = () => `series_videos_page_${route.params.id}`
const filterKey = () => `series_videos_filter_${route.params.id}`

const openEditDialog = () => {
  showEditDialog.value = true
}

const onEditSave = async (formData) => {
  try {
    await seriesApi.update(series.value.id, formData)
    showEditDialog.value = false
    await loadSeries()
    ui.success('已保存')
  } catch (err) {
    console.error('保存系列失败:', err)
    ui.error('保存失败：' + errText(err))
  }
}

const onDelete = async (id) => {
  const go = await ui.confirm({ title: '确认删除', message: '确定要删除该系列吗？', danger: true })
  if (!go) return
  try {
    await seriesApi.delete(id)
    showEditDialog.value = false
    ui.success('已删除')
    // 原先用 window.location.href 整页刷新，现在走路由跳转
    router.push('/series')
  } catch (err) {
    console.error('删除系列失败:', err)
    ui.error('删除失败：' + errText(err))
  }
}

const loadSeries = async () => {
  try {
    const res = await seriesApi.getDetail(route.params.id)
    if (res.success) {
      series.value = res.data
      return ''
    }
    return res.message || '系列信息加载失败'
  } catch (err) {
    console.error('加载系列详情失败:', err)
    return '系列信息加载失败，请确认后端服务可用'
  }
}

const loadVideos = async () => {
  videosLoading.value = true
  videosError.value = ''
  try {
    const params = { page: page.value, pageSize: pageSize.value }
    const { subtitle, watermark, resolution } = sourceFilter.value
    if (subtitle) params.subtitle = subtitle
    if (watermark) params.watermark = watermark
    if (resolution) params.resolution = resolution
    const res = await seriesApi.getVideos(route.params.id, params)
    if (res.success) {
      const count = res.total || 0
      const last = Math.max(1, Math.ceil(count / pageSize.value))
      if (page.value > last) {
        // 记下的那一页可能已经不存在（删过片、或改了每页条数）：退到最后一页重取一次
        page.value = last
        videosLoading.value = false
        return loadVideos()
      }
      videos.value = res.data || []
      total.value = count
    } else {
      videosError.value = res.message || '系列影片加载失败'
    }
  } catch (err) {
    console.error('加载系列影片失败:', err)
    videosError.value = '系列影片加载失败，请确认后端服务可用'
  } finally {
    videosLoading.value = false
  }
}

const SORT_PAGE_SIZE = 500 // 后端 ClampSize 的上限
const SORT_MAX_PAGES = 20  // 兜底，避免服务端分页异常时死循环

// 保存排序要提交整个系列的 id 序列（后端按下标写 sort_order，
// 少提交的那批会留在旧序号上），所以排序模式必须一次取完全部影片
const loadAllVideos = async () => {
  const merged = []
  let current = 1
  let serverTotal
  do {
    const res = await seriesApi.getVideos(route.params.id, { page: current, pageSize: SORT_PAGE_SIZE })
    if (!res.success) throw new Error(res.message || '系列影片加载失败')
    merged.push(...(res.data || []))
    serverTotal = res.total || merged.length
    current += 1
  } while (merged.length < serverTotal && current <= SORT_MAX_PAGES)

  // 只拿到一部分就去保存会把没拿到的那些排到旧序号上，宁可拒绝
  if (merged.length < serverTotal) throw new Error('影片数量过大，无法一次载入排序')
  return merged
}

const loadAll = async () => {
  loading.value = true
  error.value = ''
  const message = await loadSeries()
  loading.value = false
  if (message) {
    error.value = message
    return
  }
  await loadVideos()
}

// === 排序相关 ===
let pageBeforeSort = 1

const startSort = async () => {
  if (sorting.value || videosLoading.value) return
  pageBeforeSort = page.value
  sorting.value = true
  // 排序是对整个系列重编号，带着筛选进来会只提交一部分，先清掉
  clearSourceFilter()
  videosLoading.value = true
  videosError.value = ''
  try {
    videos.value = await loadAllVideos()
    total.value = videos.value.length
  } catch (err) {
    console.error('进入排序模式失败:', err)
    sorting.value = false
    videosError.value = err.message || '进入排序模式失败'
    page.value = pageBeforeSort
    await loadVideos()
  } finally {
    videosLoading.value = false
  }
}

const cancelSort = async () => {
  sorting.value = false
  dragIndex.value = null
  dragOverIndex.value = null
  // 未提交的改动直接回服务端读数，比本地备份更可靠
  page.value = pageBeforeSort
  await loadVideos()
}

const saveSort = async () => {
  if (savingSort.value) return
  savingSort.value = true
  try {
    const videoIds = videos.value.map((v) => v.id)
    const res = await seriesApi.updateSort(route.params.id, { videoIds })
    if (res.success) {
      sorting.value = false
      dragIndex.value = null
      dragOverIndex.value = null
      // 重新加载以获取服务端最新排序
      page.value = 1
      await loadVideos()
      ui.success('排序已保存')
    } else {
      ui.error('保存排序失败：' + errText(res, '未知错误'))
    }
  } catch (err) {
    console.error('保存排序失败:', err)
    ui.error('保存排序失败：' + errText(err))
  } finally {
    savingSort.value = false
  }
}

const onDragStart = (e, index) => {
  dragIndex.value = index
  e.dataTransfer.effectAllowed = 'move'
  // Firefox 需要 setData
  e.dataTransfer.setData('text/plain', String(index))
}

const onDragOver = (e, index) => {
  e.dataTransfer.dropEffect = 'move'
  if (dragIndex.value !== null && dragIndex.value !== index) {
    dragOverIndex.value = index
  }
}

const onDragLeave = (index) => {
  if (dragOverIndex.value === index) {
    dragOverIndex.value = null
  }
}

const onDrop = (e, index) => {
  e.preventDefault()
  const from = dragIndex.value
  if (from === null || from === index) {
    onDragEnd()
    return
  }
  // 排序模式下不带筛选，视图下标即数组下标
  const [moved] = videos.value.splice(from, 1)
  videos.value.splice(index, 0, moved)
  onDragEnd()
}

const onDragEnd = () => {
  dragIndex.value = null
  dragOverIndex.value = null
}

const decodeUrl = (url) => {
  try {
    return decodeURIComponent(url)
  } catch {
    return url
  }
}

onMounted(async () => {
  await app.init()
  // 每页条数是在设置里配的，页数与筛选只是"翻到哪儿、按哪一筛看"：进来先回到上次那一屏
  page.value = rememberedPage(pageKey())
  applyRememberedFilter()
  await loadAll()
})

watch(
  () => route.params.id,
  (newId) => {
    if (!newId) return
    series.value = null
    page.value = rememberedPage(pageKey())   // 每个系列各记各的那一页
    applyRememberedFilter()                  // 以及各记各的那一筛
    sorting.value = false
    loadAll()
  }
)

// 筛选一变就落本地；三维全空等于没记忆
watch(sourceFilter, () => rememberFilter(filterKey(), sourceFilter.value), { deep: true })

// 翻页就落一次本地，不等退出页面再攒（保存排序后回到第一页，这条记忆也就跟着清掉）
watch(page, (n) => rememberPage(pageKey(), n))

// 筛选是服务端行为，改动后回到第一页重新取（三维存在一个对象里，要 deep 才看得到里面变了）
watch(
  sourceFilter,
  () => {
    // 切系列时 loadAll 自己会取影片；排序模式整系列重载也不该被筛选打断
    if (loading.value || sorting.value) return
    page.value = 1
    loadVideos()
  },
  { deep: true }
)
</script>

<style scoped>
.series-detail {
  display: flex;
  flex-direction: column;
  gap: var(--s5);
}

.loading-block {
  display: flex;
  flex-direction: column;
  gap: var(--s5);
}

.head-skeleton {
  height: calc(var(--s7) * 3);
  border-radius: var(--r2);
}

/* 封面 3:2 再加约三行文字的高度 */
.card-skeleton {
  aspect-ratio: 1 / 1.08;
  border-radius: var(--r2);
}

.series-header {
  display: flex;
  flex-direction: column;
  gap: var(--s3);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: var(--s2);
  flex-wrap: wrap;
}

.tag-row {
  display: flex;
  align-items: center;
  gap: var(--s2);
  flex-wrap: wrap;
}

.alias-row {
  color: var(--text-dim);
  font-size: var(--f-md);
}

.link-row {
  color: var(--text-dim);
  font-size: var(--f-md);
}

.link-row a {
  color: var(--accent);
  word-break: break-all;
}

.link-row a:hover {
  color: var(--accent-strong);
}

.sort-hint {
  border-color: var(--accent);
  background: var(--accent-soft);
  color: var(--accent);
}

.videos-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--s3);
  flex-wrap: wrap;
}

/* 三维筛选横排在标题右侧，放不下就换行（不套 .filters 那个带底色的框，这里已经在板块头里） */
.media-filter {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--s2);
  flex-wrap: wrap;
}

.media-filter .select {
  min-width: 132px;
}

.video-slot {
  position: relative;
  min-width: 0;
}

.grid-sorting .video-slot {
  cursor: grab;
  border-radius: var(--r2);
  transition: transform var(--dur) var(--ease), box-shadow var(--dur) var(--ease);
}

.grid-sorting .video-slot:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-2);
}

.grid-sorting .video-slot.dragging {
  opacity: .4;
  cursor: grabbing;
}

.grid-sorting .video-slot.drag-over {
  outline: 2px dashed var(--accent);
  outline-offset: 2px;
  background: var(--accent-soft);
  border-radius: var(--r2);
}

.sort-badge {
  position: absolute;
  top: calc(-1 * var(--s2));
  left: calc(-1 * var(--s2));
  z-index: 2;
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border-radius: var(--rp);
  background: var(--accent);
  color: var(--accent-ink);
  font-size: var(--f-sm);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  box-shadow: var(--shadow-1);
}
</style>
