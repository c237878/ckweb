<template>
  <div class="page like-list">
    <div class="page-header">
      <h1 class="page-title">点赞记录</h1>
      <div class="header-actions">
        <label class="select-all">
          <input type="checkbox" :checked="allChecked" @change="toggleAll" />
          全选本页
        </label>
        <button v-if="selectedIds.length > 0" class="btn btn--sm btn--danger" @click="handleBatchDelete">
          删除选中 ({{ selectedIds.length }})
        </button>
      </div>
    </div>

    <!-- 一次性的操作结果（删除失败等），会被读屏播报 -->
    <p v-if="feedback" class="notice" :class="isFeedbackError ? 'notice--error' : ''" role="status">{{ feedback }}</p>

    <div class="filters">
      <label class="sr-only" for="like-keyword">关键词</label>
      <input
        id="like-keyword"
        v-model="keyword"
        class="input grow"
        type="search"
        placeholder="搜索名称或番号..."
        @keyup.enter="handleSearch"
      />
      <SelectList
        v-model="targetType"
        :options="LIKE_TARGET_OPTIONS"
        all-label="全部类型"
        label="内容类型"
        @change="handleSearch"
      />
      <label for="like-start">点赞时间</label>
      <input id="like-start" v-model="startDate" class="input" type="date" @change="handleSearch" />
      <span class="date-sep">~</span>
      <label class="sr-only" for="like-end">结束日期</label>
      <input id="like-end" v-model="endDate" class="input" type="date" @change="handleSearch" />
      <button class="btn btn--sm btn--primary" @click="handleSearch">搜索</button>
      <button class="btn btn--sm btn--ghost" @click="handleReset">重置</button>
    </div>

    <div v-if="loading" class="rows" aria-busy="true" aria-label="加载中">
      <div v-for="n in Math.min(pageSize, 10)" :key="n" class="skeleton row-skeleton"></div>
    </div>

    <div v-else-if="error" class="notice notice--error" role="alert">
      <span>{{ error }}</span>
      <button class="btn btn--sm" @click="loadList">重试</button>
    </div>

    <div v-else-if="!likeList.length" class="empty">
      <p>{{ hasActiveFilter ? '没有符合条件的点赞记录' : '还没有点赞记录' }}</p>
      <button v-if="hasActiveFilter" class="btn btn--sm" @click="handleReset">清除筛选</button>
      <router-link v-else to="/videos" class="btn btn--primary">去挑几部</router-link>
    </div>

    <div v-else class="card table-wrap">
      <table class="table">
        <caption class="sr-only">点赞记录列表，共 {{ total }} 条</caption>
        <thead>
          <tr>
            <th class="col-check"><span class="sr-only">全选</span></th>
            <th class="col-cover">封面</th>
            <th>名称</th>
            <th class="col-code">番号</th>
            <th class="col-type">类型</th>
            <th class="col-prog">播放进度</th>
            <th class="col-time">点赞时间</th>
            <th class="col-actions">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in likeList" :key="item.id">
            <td class="col-check">
              <label class="sr-only" :for="'like-' + item.id">选中 {{ item.name || '该记录' }}</label>
              <input
                :id="'like-' + item.id"
                type="checkbox"
                :checked="selectedIds.includes(item.id)"
                @change="toggleSelect(item.id)"
              />
            </td>
            <td class="col-cover">
              <img
                v-if="item.coverPath"
                :src="getCoverUrl(item)"
                :alt="`${item.name || '已删除内容'}封面`"
                class="row-cover"
                width="84"
                height="56"
                loading="lazy"
                decoding="async"
                @click="goToDetail(item)"
              />
              <span v-else class="no-cover">无封面</span>
            </td>
            <td class="col-name-cell" @click="goToDetail(item)">{{ item.name || '(已删除)' }}</td>
            <td class="col-code">{{ item.code || '-' }}</td>
            <td class="col-type">
              <div class="type-tags">
              <span class="tag" :class="item.targetType === 'comic' ? 'tag--accent' : 'tag--info'">
                {{ item.targetType === 'comic' ? '漫画' : '影片' }}
              </span>
              <!-- 赞的是哪一版（v11）：这一列本来就管"这条记录是什么"，版本放这儿而不是番号列，
                   免得窄屏那行四列被长番号 + 版本名一起撑爆；原版不标，因为番号已经对得上 -->
              <span
                v-if="likedOtherVersion(item)"
                class="tag tag--muted like-version"
                :title="`赞的是「${item.versionName || item.versionCode}」这一版`"
              >{{ item.versionName || item.versionCode }}</span>
              </div>
            </td>
            <td class="col-prog">
              <!-- 赞在哪个点（v12）：这是那一版时间轴上的位置，和版本列对着看才有意义。
                   老记录没存过就是"—"，不是 0:00 -->
              {{ formatClock(item.playTime) || '—' }}
            </td>
            <td class="col-time">{{ formatDate(item.likedAt, true) || '-' }}</td>
            <td class="col-actions">
              <button class="btn btn--sm btn--danger" @click="handleDelete(item)">删除</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <Pagination v-model:page="page" :page-size="pageSize" :total="total" @change="handlePageChange" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { likeApi, videoApi, comicApi } from '@/scripts/api'
import { useAppStore } from '@/scripts/store/app'
import { useUiStore } from '@/scripts/store/ui'
import { formatDate, formatClock } from '@/scripts/utils/format'
import { LIKE_TARGET_OPTIONS } from '@/scripts/constants'
import { loadFilterState, saveFilterState } from '@/scripts/utils/filterPersist'
import Pagination from '@/views/components/Pagination.vue'
import SelectList from '@/views/components/SelectList.vue'

const router = useRouter()
const app = useAppStore()
const ui = useUiStore()
const STORAGE_KEY = 'like-list'

const likeList = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = computed(() => app.pageSize)
const loading = ref(true)
const error = ref('')
const feedback = ref('')
const isFeedbackError = ref(false)
const keyword = ref('')
const targetType = ref('')
const startDate = ref('')
const endDate = ref('')
const selectedIds = ref([])

// 筛选与页码持久化（keyword 不缓存，否则下次进来仍是半截搜索）
watch([targetType, startDate, endDate, page], () => {
  saveFilterState(STORAGE_KEY, {
    targetType: targetType.value,
    startDate: startDate.value,
    endDate: endDate.value,
    page: page.value
  })
})

const allChecked = computed(
  () => likeList.value.length > 0 && likeList.value.every((i) => selectedIds.value.includes(i.id))
)

const hasActiveFilter = computed(
  () => !!(keyword.value || targetType.value || startDate.value || endDate.value)
)

const tell = (msg, isError = false) => {
  feedback.value = msg
  isFeedbackError.value = isError
}

/**
 * 这条点赞是不是落在"不是原版"的那一版上（v11）。
 * 原版不标：那条记录的番号本来就和影片对得上，标一颗"原版"全是噪音。
 */
const likedOtherVersion = (item) =>
  !!item.versionCode && item.versionCode !== item.code

const getCoverUrl = (item) =>
  item.targetType === 'comic'
    ? comicApi.getCoverUrl(item.coverPath)
    : videoApi.getCoverUrl(item.videoId)

const goToDetail = (item) => {
  if (item.targetType === 'comic') {
    router.push(`/comic/${item.videoId}`)
  } else {
    router.push(`/video/${item.videoId}`)
  }
}

const loadList = async () => {
  loading.value = true
  error.value = ''
  try {
    const params = { pageIndex: page.value, pageSize: pageSize.value }
    if (keyword.value) params.keyword = keyword.value
    if (targetType.value) params.targetType = targetType.value
    if (startDate.value) params.startDate = startDate.value
    if (endDate.value) params.endDate = endDate.value

    const res = await likeApi.getList(params)
    if (res.success) {
      likeList.value = res.data?.list || []
      total.value = res.data?.total || 0
      // 换页后旧的勾选要清掉，否则会删到看不见的行
      selectedIds.value = []
    } else {
      error.value = res.message || '点赞记录加载失败'
    }
  } catch (err) {
    console.error('加载点赞记录失败:', err)
    error.value = '点赞记录加载失败，请确认后端服务可用'
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  page.value = 1
  loadList()
}

const handleReset = () => {
  keyword.value = ''
  targetType.value = ''
  startDate.value = ''
  endDate.value = ''
  page.value = 1
  loadList()
}

const handlePageChange = () => {
  loadList()
}

const toggleAll = () => {
  selectedIds.value = allChecked.value ? [] : likeList.value.map((i) => i.id)
}

const toggleSelect = (id) => {
  const idx = selectedIds.value.indexOf(id)
  if (idx >= 0) selectedIds.value.splice(idx, 1)
  else selectedIds.value.push(id)
}

const handleDelete = async (item) => {
  // 对话框正文不是 pre-wrap，原来那个 \n 会塌成空格，所以用书名号把名称并到一句里
  const label = item.name ? `「${item.name}」` : ''
  const go = await ui.confirm({
    title: '确认删除',
    message: `确认删除这条点赞记录？${label}`,
    danger: true
  })
  if (!go) return
  try {
    const res = await likeApi.delete(item.id)
    if (res.success) {
      await loadList()
      // 观影日历是常驻组件（挂在 App 上，不随路由重建），只监听这个事件重取统计。
      // 以前这里删完只刷了自己那份列表，日历要等整页刷新才动
      window.dispatchEvent(new CustomEvent('likesUpdated', { detail: { id: item.videoId } }))
      ui.success('已删除')
    } else {
      tell(res.message || '删除失败', true)
    }
  } catch (error_) {
    console.error('删除失败:', error_)
    tell('删除失败：' + (error_.message || error_), true)
  }
}

// 批量删除走单个请求，不再逐条 delete
const handleBatchDelete = async () => {
  if (selectedIds.value.length === 0) return
  const go = await ui.confirm({
    title: '确认删除',
    message: `确认删除选中的 ${selectedIds.value.length} 条记录？`,
    danger: true
  })
  if (!go) return
  try {
    const res = await likeApi.batchDelete([...selectedIds.value])
    if (res.success) {
      selectedIds.value = []
      await loadList()
      // 一次删掉 N 条，日历要重取的不止当天：派发一次让它整月重算
      window.dispatchEvent(new CustomEvent('likesUpdated', { detail: { batch: true } }))
      ui.success('已删除选中的记录')
    } else {
      tell(res.message || '批量删除失败', true)
    }
  } catch (err) {
    console.error('批量删除失败:', err)
    tell('批量删除失败：' + (err.message || err), true)
  }
}

onMounted(async () => {
  const saved = loadFilterState(STORAGE_KEY)
  if (saved) {
    targetType.value = saved.targetType ?? ''
    startDate.value = saved.startDate ?? ''
    endDate.value = saved.endDate ?? ''
    page.value = saved.page ?? 1
  }
  // 每页数量取自站点设置
  await app.init()
  await loadList()
})
</script>

<style scoped>
.like-list {
  display: flex;
  flex-direction: column;
  gap: var(--s4);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: var(--s3);
  flex-wrap: wrap;
}

.select-all {
  display: inline-flex;
  align-items: center;
  gap: var(--s2);
  font-size: var(--f-sm);
  color: var(--text-dim);
  cursor: pointer;
}

.select-all input,
.col-check input {
  width: 16px;
  height: 16px;
  accent-color: var(--accent);
  cursor: pointer;
}

.date-sep {
  color: var(--text-faint);
}

.rows {
  display: flex;
  flex-direction: column;
  gap: var(--s2);
}

.row-skeleton {
  height: 64px;
  border-radius: var(--r1);
}

.col-check {
  width: 40px;
}

.col-cover {
  width: 100px;
}

.col-code,
.col-type {
  white-space: nowrap;
}

/* 类型列现在可能有两颗（影片 / 哪一版）：用可换行的 flex 容器装，
   继承下来的 nowrap 只管字内部不断行，两颗放不下时才折到第二行 */
.type-tags {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s1);
  min-width: 0;
}

/* 版本那颗限宽：类型名一般就两三个字，兜住极端长的手填名称，
   不让它把这一列顶到下一行去 */
.like-version {
  max-width: 7em;
  overflow: hidden;
  text-overflow: ellipsis;
}

.col-code {
  font-variant-numeric: tabular-nums;
  color: var(--text-dim);
}

.col-time {
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
  color: var(--text-dim);
}

/* 进度就一个 mm:ss / h:mm:ss，跟时间列同一套排版，但别换行成两截 */
.col-prog {
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
  color: var(--text-dim);
}

.col-actions {
  width: 84px;
}

/* 全局 img 有 max-width:100%，窄屏下表格把封面列压窄时定高会把图片压扁，
   所以宽度可缩、高度交给宽高比（与卡片封面同一个 token） */
.row-cover {
  width: 84px;
  height: auto;
  aspect-ratio: var(--ratio-cover);
  object-fit: cover;
  border-radius: var(--r1);
  cursor: pointer;
  background: var(--bg-elev-2);
}

.no-cover {
  display: grid;
  place-items: center;
  width: 84px;
  aspect-ratio: var(--ratio-cover);
  border-radius: var(--r1);
  background: var(--bg-elev-2);
  color: var(--text-faint);
  font-size: var(--f-xs);
}

.col-name-cell {
  cursor: pointer;
  color: var(--accent);
  min-width: 180px;
}

.col-name-cell:hover {
  text-decoration: underline;
}

/* 窄屏：84px 的缩略图挤占正文却根本看不清内容，整列去掉（进详情走名称那一格，入口没少）。
   去掉后剩下的列横向仍排不进 390px —— 表格会自动把名称压成一字一行，所以改成每行两段的栅格：
   名称独占一行拿满宽度，番号/类型/时间压成第二行的次要信息 */
@media (max-width: 899px) {
  .col-cover {
    display: none;
  }

  .table,
  .table tbody {
    display: block;
  }

  .table thead {
    display: none;
  }

  .table tbody tr {
    display: grid;
    grid-template-columns: auto minmax(0, auto) minmax(0, auto) minmax(0, auto) minmax(0, auto);
    /* 多了一列进度，窄屏就从两行变三行：把进度和时间放同一行，两边都短，
       不会像硬塞进原来那行那样在 390 宽上溢出 */
    grid-template-areas:
      "check name name name act"
      "check code type type act"
      "check prog time time act";
    gap: var(--s1) var(--s3);
    align-items: center;
    padding: var(--s3);
    border-bottom: 1px solid var(--border);
  }

  .table tbody tr:last-child {
    border-bottom: none;
  }

  .table tbody td {
    padding: 0;
    border-bottom: none;
  }

  .col-check {
    grid-area: check;
  }

  .col-name-cell {
    grid-area: name;
    min-width: 0;
  }

  .col-code {
    grid-area: code;
  }

  .col-type {
    grid-area: type;
  }

  .col-time {
    grid-area: time;
    font-size: var(--f-xs);
  }

  .col-prog {
    grid-area: prog;
    font-size: var(--f-xs);
  }

  .col-actions {
    grid-area: act;
    width: auto;
  }
}
</style>
