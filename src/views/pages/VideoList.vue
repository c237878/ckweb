<template>
  <div class="page video-list">
    <div class="page-header">
      <h1 class="page-title">影片列表</h1>
      <div class="header-actions">
        <template v-if="mode === 'browse'">
          <button
            class="btn btn--sm"
            :class="{ 'btn--ghost': scanRunning }"
            :title="scanRunning ? '正在读的那一个会读完，然后停下' : '逐个读视频文件的容器头量分辨率（只读文件，不改文件；字幕和广告水印由你自己标）。没量过的后台也会按设好的节奏自己补一遍（设置→运行状态），这个按钮是立刻补'"
            @click="scanRunning ? stopScan() : startScan()"
          >
            {{ scanRunning ? '停止扫描' : '扫描片源' }}
          </button>
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

    <!-- 只在任务真的在跑时出现，跑完收到结果提示就收起（服务端在跑，离开页面不影响） -->
    <JobBar v-if="scanRunning" :text="scanText" :percent="scan.percent" />

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
        v-model="filters.subtitle"
        :options="SUBTITLE_OPTIONS"
        all-label="全部字幕"
        label="按字幕情况筛选"
        @change="applyFilter"
      />
      <SelectList
        v-model="filters.watermark"
        :options="WATERMARK_OPTIONS"
        all-label="全部水印"
        label="按广告水印筛选"
        @change="applyFilter"
      />
      <SelectList
        v-model="filters.resolution"
        :options="RESOLUTION_OPTIONS"
        all-label="全部分辨率"
        label="按分辨率筛选"
        @change="applyFilter"
      />
      <SelectList
        v-model="filters.codec"
        :options="CODEC_OPTIONS"
        all-label="全部编码"
        label="按视频编码筛选"
        @change="applyFilter"
      />
      <SelectList
        v-model="filters.studio"
        :options="studioOptions"
        all-label="全部片商"
        label="按片商筛选"
        @change="applyFilter"
      />
      <SelectList
        v-model="filters.typeId"
        :options="versionTypeOptions"
        all-label="全部版本"
        label="按版本类型筛选"
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

    <!-- 校验文件名：改名会动盘上真实文件，所以分两步 —— 先预检列出"要动哪几个"，
         看清了再点「执行改名」。后端默认就是预检（dryRun），这里不传 false 就一个字节都不动 -->
    <div v-if="renameResult" class="overlay" @click.self="renameResult = null">
      <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="rename-title">
        <div class="dialog__head">
          <h3 class="dialog__title" id="rename-title">{{ renameResult.dryRun ? '校验文件名（预检）' : '校验文件名（已执行）' }}</h3>
          <button class="dialog__close" aria-label="关闭" @click="renameResult = null">&times;</button>
        </div>
        <div class="dialog__body">
          <p class="summary">
            {{ renameResult.renamed }} 处{{ renameResult.dryRun ? '要改' : '已改' }} ·
            跳过 {{ renameResult.skipped }} · 失败 {{ renameResult.failed }}
          </p>
          <ul class="detail-list">
            <li
              v-for="(item, i) in renameResult.details"
              :key="i"
              :class="{ failed: item.error || item.errors?.length }"
            >
              <strong>{{ item.code }}</strong>
              <em class="kind">{{ item.kind === 'cover' ? '封面' : '视频' }}</em>
              <span v-if="item.error || item.errors?.length">{{ item.error || item.errors.join('；') }}</span>
              <span v-else-if="item.newFile">{{ baseName(item.newFile) }}</span>
              <span v-else-if="item.newCover">{{ baseName(item.newCover) }}</span>
              <span v-else>无需调整</span>
            </li>
          </ul>
        </div>
        <div class="dialog__foot">
          <button class="btn" @click="renameResult = null">关闭</button>
          <button
            v-if="renameResult.dryRun && renameResult.renamed > 0"
            class="btn btn--primary"
            :disabled="renaming"
            @click="applyRename"
          >
            {{ renaming ? '处理中…' : `执行改名（${renameResult.renamed} 处）` }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { videoApi, studioApi, versionTypeApi } from '@/scripts/api'
import { useAppStore } from '@/scripts/store/app'
import { useUiStore, errText } from '@/scripts/store/ui'
import { SORT_OPTIONS, SUBTITLE_OPTIONS, WATERMARK_OPTIONS, RESOLUTION_OPTIONS, CODEC_OPTIONS } from '@/scripts/constants'
import { debounce } from '@/scripts/utils/debounce'
import VideoCard from '@/views/components/VideoCard.vue'
import AddVideoDialog from '@/views/components/AddVideoDialog.vue'
import JobBar from '@/views/components/JobBar.vue'
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
const route = useRoute()
const router = useRouter()

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
  subtitle: '',
  watermark: '',
  resolution: '',
  codec: '',
  studio: '',
  typeId: '',

})

// 词表下拉：一次拉全（几百项），值用 id——名字会改，id 不会
const studioOptions = ref([])
// 版本类型词表：设置里点「看这一类型的片」会带 ?typeId= 跳过来，这里也要能显示成名字
const versionTypeOptions = ref([])

const pageSize = computed(() => app.pageSize)

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

// 深链（首页分类板块、设置里「看这一类型的片」）优先于 localStorage 里的浏览状态：
// 点进来是明确意图，不能被上次留下的筛选叠上去变成"看不出为什么是这个结果"
const FILTER_KEYS = ['category', 'country', 'seriesId', 'keyword', 'downloaded',
  'subtitle', 'watermark', 'resolution', 'codec', 'studio', 'typeId', 'sortBy']

const applyQueryFilters = () => {
  const q = route.query || {}
  const hits = FILTER_KEYS.filter((k) => q[k] !== undefined && q[k] !== '')
  if (!hits.length) return false
  filters.value = Object.keys(filters.value).reduce((acc, k) => ({ ...acc, [k]: '' }), {})
  hits.forEach((k) => {
    const raw = q[k]
    filters.value[k] = String(Array.isArray(raw) ? raw[0] : raw)
  })
  page.value = 1
  return true
}

onMounted(async () => {
  const saved = loadFilterState(STORAGE_KEY)
  if (saved?.filters) filters.value = { ...filters.value, ...saved.filters, keyword: '' }
  if (saved?.page) page.value = saved.page
  applyQueryFilters()

  await app.init()
  await Promise.all([loadMeta(), loadVocab(), loadVideos()])
  // 刷新页面或换台电脑进来时，正在跑的扫描要看得见
  pollScan()
})

// 地址栏换了筛选条件（含浏览器前进后退）就跟着走；自己 syncQuery 写回去的那一下不算，
// 否则改一次下拉要发两次列表请求
watch(() => route.query, (q) => {
  if (route.name !== 'VideoList') return
  if (querySame(currentQuery(), q)) return
  applyQueryFilters()
  loadVideos()
})

const loadVocab = async () => {
  try {
    const [s, t] = await Promise.all([studioApi.getList({ pageSize: 500 }), versionTypeApi.getList()])
    if (s.success) studioOptions.value = (s.data || []).map((x) => ({ value: x.id, label: `${x.name} (${x.videoCount})` }))
    if (t.success) versionTypeOptions.value = (t.data || []).map((x) => ({ value: x.id, label: `${x.name} (${x.used})` }))
  } catch (err) {
    // 片商词表拉不到只是少一个下拉，不该挡住列表
    console.error('加载词表失败:', err)
  }
}

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
    if (filters.value.subtitle) params.subtitle = filters.value.subtitle
    if (filters.value.watermark) params.watermark = filters.value.watermark
    if (filters.value.resolution) params.resolution = filters.value.resolution
    if (filters.value.codec) params.codec = filters.value.codec
    if (filters.value.studio) params.studio = filters.value.studio
    if (filters.value.typeId) params.typeId = filters.value.typeId
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
  syncQuery()
  loadVideos()
}

// 地址栏跟着筛选走：改了条件却留着 ?typeId=… 的话，一刷新又跳回点进来的那个类型，
// 像是没生效。replace 不压历史，前进后退仍然只按页面本身
const currentQuery = () => {
  const q = {}
  FILTER_KEYS.forEach((k) => {
    const v = filters.value[k]
    if (v !== '' && v !== null && v !== undefined) q[k] = String(v)
  })
  return q
}
// 两边比的是同一组键，顺序无关
const querySame = (a, b) => {
  const ka = Object.keys(a).filter((k) => a[k] !== undefined && a[k] !== '')
  const kb = Object.keys(b).filter((k) => b[k] !== undefined && b[k] !== '')
  return ka.length === kb.length && ka.every((k) => String(a[k]) === String(b[k]))
}
const syncQuery = () => {
  const q = currentQuery()
  if (querySame(q, route.query)) return
  router.replace({ path: route.path, query: q })
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
  filters.value = {
    country: '', category: '', seriesId: '', keyword: '', downloaded: '',
    subtitle: '', watermark: '', resolution: '', codec: '', studio: '', typeId: '', sortBy: ''
  }
  applyFilter()
}

const openAdd = () => {
  editingVideo.value = null
  showAddDialog.value = true
}

// 扫描任务在服务端后台跑，这里只是看它：启动 → 每 2 秒轮一次进度 → 结束后收一条提示。
// 离开页面只摘掉轮询，不打断任务——全库是十分钟级的活，关浏览器不该把它带走。
const scan = ref(null)
let scanTimer = null
let scanWatching = false

const scanRunning = computed(() => !!scan.value?.running)
const fmtEta = (sec) => (sec >= 60 ? `约剩 ${Math.round(sec / 60)} 分钟` : `约剩 ${sec} 秒`)
const scanText = computed(() => {
  const s = scan.value
  if (!s) return ''
  if (!s.total) return '正在清点要扫的影片…'
  const tail = s.etaSeconds ? ` · ${fmtEta(s.etaSeconds)}` : ''
  // 读不出分两种：文件根本不在盘上（卷掉了/搬走了）与文件在但读不出容器头（多半没下完）。
  // 只有前者值得人去看一眼，所以单独报出来
  const gone = s.missing ? `（其中 ${s.missing} 个不在盘上）` : ''
  return `扫描${s.what} · 已读 ${s.processed} / ${s.total} · 量到 ${s.ok} 个 · 读不出 ${s.missed} 个${gone}${tail}`
})

const stopScanPoll = () => {
  if (scanTimer) {
    clearInterval(scanTimer)
    scanTimer = null
  }
}

// 轮询只挂一份：中途打开页面（定时扫描正在跑）和点按钮启动走的是同一条路
const ensureScanPolling = () => {
  if (scanTimer) return
  scanTimer = setInterval(pollScan, 2000)
}

const pollScan = async () => {
  let res
  try {
    res = await videoApi.scanStatus()
  } catch {
    return // 轮询失败下一轮再来，不值得弹错误
  }
  if (!res.success) return

  if (res.data.running) {
    scan.value = res.data
    scanWatching = true
    // 一天跑一次的定时扫描不等人点按钮：页面是中途打开的话，这里得把轮询自己接上，
    // 否则进度条会停在打开那一刻的数字上不动，看起来像卡住了
    ensureScanPolling()
    return
  }

  // 不在跑了：条子立刻收起，结果改由一条提示承载
  const s = res.data
  scan.value = null
  if (scanWatching) {
    scanWatching = false
    stopScanPoll()
    const gone = s.missing ? `，其中 ${s.missing} 个不在盘上` : ''
    ui[s.note ? 'warn' : 'info'](
      `扫描结束：读 ${s.processed} 个，量到 ${s.ok} 个，读不出 ${s.missed} 个${gone}${s.note ? ` · ${s.note}` : ''}`
    )
    loadVideos()
  }
}

const startScan = async () => {
  try {
    const res = await videoApi.startScanAll()
    if (!res.success) {
      ui.warn(res.message || '没能启动')
      return
    }
    ui.info(res.message)
    scanWatching = true
    scan.value = res.data
    ensureScanPolling()
  } catch (err) {
    console.error('启动扫描失败:', err)
    ui.error('启动失败：' + errText(err))
  }
}

const stopScan = async () => {
  try {
    const res = await videoApi.stopScanAll()
    ui.info(res.message || '已请求停止')
  } catch (err) {
    ui.error('停止失败：' + errText(err))
  }
}

// 只摘轮询：任务本身在服务端，不该被页面卸载带走
onBeforeUnmount(stopScanPoll)

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

// 第一步：预检。只回"会动哪几个文件"，盘上一个都不改
const checkAndRename = async () => {
  if (renaming.value) return
  renaming.value = true
  try {
    const res = await videoApi.renameToCode(true)
    if (res.success) {
      renameResult.value = { dryRun: res.dryRun, ...res.data }
      if (!res.data.renamed) ui.success('文件名都与番号一致，没有要改的')
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

// 第二步：真要改名了 —— 这一步改的是盘上的文件，所以按钮放在预检清单里，
// 看完"要动哪几个"才点得到
const applyRename = async () => {
  if (renaming.value) return
  const go = await ui.confirm({
    title: '执行改名',
    message: `按清单重命名 ${renameResult.value?.renamed ?? 0} 个文件（视频与封面都会动）。`
      + '库里记的路径会跟着改，播放不受影响。',
    danger: true,
    confirmLabel: '开始改名'
  })
  if (!go) return
  renaming.value = true
  try {
    const res = await videoApi.renameToCode(false)
    if (res.success) {
      renameResult.value = { dryRun: res.dryRun, ...res.data }
      await loadVideos()
      ui.success(`已改名 ${res.data.renamed} 处`)
    } else {
      ui.error('改名失败：' + errText(res, '未知错误'))
    }
  } catch (err) {
    console.error('执行改名失败:', err)
    ui.error('改名失败：' + errText(err))
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

/** 保存失败要留在弹窗里：后端对"发行日期格式不对"这类业务失败回的是 200 + success:false，
    不判 success 就会明明没存上却提示"已保存" */
const handleSaveVideo = async (formData) => {
  try {
    const res = formData.id ? await videoApi.update(formData.id, formData) : await videoApi.add(formData)
    if (!res?.success) return ui.error(res?.message || '保存失败')
    showAddDialog.value = false
    editingVideo.value = null
    await Promise.all([loadVideos(), loadMeta()])
    // 消息里可能带"同系列另外 N 部也补上了片商"，别把它吞成一句"已保存"
    ui.success(res.message || '已保存')
  } catch (err) {
    console.error('保存失败:', err)
    ui.error('保存失败：' + errText(err))
  }
}

const handleSaveContinue = async (formData) => {
  try {
    const res = await videoApi.add(formData)
    if (!res?.success) return ui.error(res?.message || '添加失败')
    await Promise.all([loadVideos(), loadMeta()])
    ui.success(res.message || '已添加')
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

/* 预检清单里的次要标记：说清这一处是视频文件还是封面，别和番号抢视觉重心 */
.detail-list .kind {
  font-style: normal;
  color: var(--text-faint);
  flex-shrink: 0;
}

.detail-list li.failed {
  background: var(--danger-soft);
}

.detail-list li.failed strong {
  color: var(--danger);
}
</style>
