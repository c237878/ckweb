<template>
  <div class="page meta-lists">
    <div class="page-header">
      <h1 class="page-title">词表管理</h1>
      <div class="header-actions">
        <div class="tabs" role="tablist">
          <button
            v-for="t in TABS"
            :key="t.key"
            role="tab"
            class="tag tab"
            :class="{ 'is-on': tab === t.key }"
            :aria-selected="tab === t.key"
            @click="switchTab(t.key)"
          >
            {{ t.label }}
            <span v-if="t.key === 'pending' && pendingCount" class="tab__badge">{{ pendingCount }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- 新建：标签与片商共用一条输入 -->
    <div v-if="tab !== 'pending'" class="filters">
      <input v-model="newName" class="input grow" :placeholder="tab === 'tag' ? '新标签名' : '新片商名'" @keyup.enter="create" />
      <button class="btn btn--sm btn--primary" :disabled="!newName.trim() || busy" @click="create">添加</button>
      <input
        v-model="keyword"
        class="input grow"
        type="search"
        placeholder="搜索名称或别名…"
        @keyup.enter="load"
        @input="debouncedLoad"
      />
    </div>

    <!-- 标签词表 -->
    <table v-if="tab === 'tag'" class="grid-table">
      <thead>
        <tr><th>标签</th><th>别名</th><th class="num">影片</th><th class="num">AI 打的</th><th class="ops">操作</th></tr>
      </thead>
      <tbody>
        <tr v-for="t in rows" :key="t.id">
          <td>
            <input v-if="editing === t.id" v-model="editName" class="input input--sm" @keyup.enter="saveEdit(t)" />
            <span v-else>{{ t.name }}</span>
          </td>
          <td class="dim">{{ t.aliases.join('、') || '—' }}</td>
          <td class="num">{{ t.videoCount }}</td>
          <td class="num" :class="{ 'has-ai': t.aiCount }">{{ t.aiCount || '' }}</td>
          <td class="ops">
            <template v-if="editing === t.id">
              <button class="btn btn--sm" @click="saveEdit(t)">存</button>
              <button class="btn btn--sm btn--ghost" @click="editing = ''">取消</button>
            </template>
            <template v-else>
              <button class="btn btn--sm btn--ghost" @click="startEdit(t)">改名</button>
              <button class="btn btn--sm btn--ghost" @click="askMerge(t)">并入…</button>
              <button class="btn btn--sm btn--danger" @click="askDelete(t)">删除</button>
            </template>
          </td>
        </tr>
      </tbody>
    </table>

    <!-- 片商词表 -->
    <table v-else-if="tab === 'studio'" class="grid-table">
      <thead>
        <tr><th>片商</th><th>别名</th><th class="num">影片</th><th class="ops">操作</th></tr>
      </thead>
      <tbody>
        <tr v-for="s in rows" :key="s.id">
          <td>
            <input v-if="editing === s.id" v-model="editName" class="input input--sm" @keyup.enter="saveEdit(s)" />
            <span v-else>{{ s.name }}</span>
          </td>
          <td class="dim">{{ s.aliases.join('、') || '—' }}</td>
          <td class="num">{{ s.videoCount }}</td>
          <td class="ops">
            <template v-if="editing === s.id">
              <button class="btn btn--sm" @click="saveEdit(s)">存</button>
              <button class="btn btn--sm btn--ghost" @click="editing = ''">取消</button>
            </template>
            <template v-else>
              <button class="btn btn--sm btn--ghost" @click="startEdit(s)">改名</button>
              <button class="btn btn--sm btn--danger" @click="askDelete(s)">删除</button>
            </template>
          </td>
        </tr>
      </tbody>
    </table>

    <!-- AI 候选队列：批准 / 并入 / 驳回三个动作，词表只由这三下决定 -->
    <div v-else>
      <div v-if="!suggestions.length" class="empty"><p>待审队列是空的</p></div>
      <table v-else class="grid-table">
        <thead>
          <tr><th>候选词</th><th>来自哪部片</th><th>依据</th><th class="ops">处理</th></tr>
        </thead>
        <tbody>
          <tr v-for="sg in suggestions" :key="sg.id">
            <td><strong>{{ sg.name }}</strong></td>
            <td class="dim">
              <router-link v-if="sg.videoId" :to="`/video/${sg.videoId}`" class="link">{{ sg.videoCode || sg.videoName || '该片' }}</router-link>
            </td>
            <td class="dim">{{ sg.note || '—' }}</td>
            <td class="ops">
              <button class="btn btn--sm" :disabled="busy" @click="approve(sg)">批准为新标签</button>
              <SelectList v-model="mergeTarget[sg.id]" :options="rows2Options" all-label="并入…" label="并入已有标签" @change="mergeInto(sg)" />
              <button class="btn btn--sm btn--ghost" :disabled="busy" @click="reject(sg)">驳回</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <Pagination v-if="tab !== 'pending'" v-model:page="page" :page-size="pageSize" :total="total" @change="load" />
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { tagApi, studioApi } from '@/scripts/api'
import { useAppStore } from '@/scripts/store/app'
import { useUiStore, errText } from '@/scripts/store/ui'
import { debounce } from '@/scripts/utils/debounce'
import Pagination from '@/views/components/Pagination.vue'
import SelectList from '@/views/components/SelectList.vue'

const TABS = [
  { key: 'tag', label: '题材标签' },
  { key: 'studio', label: '片商' },
  { key: 'pending', label: 'AI 候选待审' }
]

const app = useAppStore()
const ui = useUiStore()

const tab = ref('tag')
const rows = ref([])
const suggestions = ref([])
const pendingCount = ref(0)
const total = ref(0)
const page = ref(1)
const keyword = ref('')
const newName = ref('')
const editing = ref('')
const editName = ref('')
const busy = ref(false)
const mergeTarget = ref({})

const pageSize = computed(() => app.pageSize)
const rows2Options = computed(() => rows.value.map((t) => ({ value: t.id, label: t.name })))

const load = async () => {
  if (tab.value === 'pending') return loadSuggestions()
  try {
    const api = tab.value === 'tag' ? tagApi : studioApi
    const res = await api.getList({ page: page.value, pageSize: pageSize.value, keyword: keyword.value })
    if (res.success) {
      rows.value = res.data || []
      total.value = res.total || 0
    } else ui.error(res.message || '加载失败')
  } catch (err) {
    ui.error('加载失败：' + errText(err))
  }
}

const loadSuggestions = async () => {
  try {
    const res = await tagApi.suggestions({ status: 'pending' })
    if (res.success) {
      suggestions.value = res.data || []
      pendingCount.value = suggestions.value.length
    }
    // 并入下拉要用词表，切到这一页时顺手拉一份
    if (!rows.value.length) {
      const t = await tagApi.getList({ pageSize: 500 })
      if (t.success) rows.value = t.data || []
    }
  } catch (err) {
    ui.error('加载失败：' + errText(err))
  }
}

const debouncedLoad = debounce(load, 400)

const switchTab = (key) => {
  tab.value = key
  page.value = 1
  editing.value = ''
  load()
}

const create = async () => {
  const name = newName.value.trim()
  if (!name) return
  busy.value = true
  try {
    const api = tab.value === 'tag' ? tagApi : studioApi
    const res = await api.add({ name })
    if (res.success) {
      newName.value = ''
      ui.success(res.message)
      load()
    } else ui.warn(res.message || '没建成')
  } catch (err) {
    ui.error('失败：' + errText(err))
  } finally {
    busy.value = false
  }
}

const startEdit = (row) => {
  editing.value = row.id
  editName.value = row.name
}

const saveEdit = async (row) => {
  const name = editName.value.trim()
  if (!name || name === row.name) return (editing.value = '')
  const api = tab.value === 'tag' ? tagApi : studioApi
  const res = await api.update(row.id, { name })
  if (res.success) { editing.value = ''; ui.success(res.message); load() } else ui.error(res.message || '没改')
}

const askDelete = async (row) => {
  const kind = tab.value === 'tag' ? '标签' : '片商'
  const go = await ui.confirm({
    title: `删除${kind}`,
    message: `「${row.name}」会从词表里消失，${row.videoCount} 部影片上的这一项也会一并摘掉。`,
    confirmLabel: '删除',
    danger: true
  })
  if (!go) return
  const api = tab.value === 'tag' ? tagApi : studioApi
  const res = await api.remove(row.id)
  ui[res.success ? 'success' : 'error'](res.message || (res.success ? '已删除' : '删除失败'))
  if (res.success) load()
}

const askMerge = async (from) => {
  const target = await ui.ask({
    title: '并入已有标签',
    message: `「${from.name}」的挂接与别名都会并过去，选错方向不好回退，看清目标再点。`,
    actions: rows.value.filter((r) => r.id !== from.id).slice(0, 8).map((r) => ({ value: r.id, label: r.name }))
  })
  if (!target || target === 'cancel') return
  const res = await tagApi.merge(from.id, target)
  ui[res.success ? 'success' : 'error'](res.message || '没合并')
  if (res.success) load()
}

const approve = async (sg) => {
  busy.value = true
  try {
    const res = await tagApi.approve(sg.id, null)
    ui[res.success ? 'success' : 'error'](res.message || '没成功')
    if (res.success) loadSuggestions()
  } finally {
    busy.value = false
  }
}

const mergeInto = async (sg) => {
  const target = mergeTarget.value[sg.id]
  if (!target) return
  const res = await tagApi.moveTo(sg.id, target)
  ui[res.success ? 'success' : 'error'](res.message || '没成功')
  if (res.success) { mergeTarget.value[sg.id] = ''; loadSuggestions() }
}

const reject = async (sg) => {
  const res = await tagApi.reject(sg.id)
  ui[res.success ? 'success' : 'error'](res.message || '没成功')
  if (res.success) loadSuggestions()
}

onMounted(async () => {
  await load()
  // 角标要在别的标签页也看得见，所以进页面先摸一次待审数
  const s = await tagApi.suggestions({ status: 'pending' }).catch(() => null)
  if (s?.success) pendingCount.value = (s.data || []).length
})
</script>

<style scoped>
.meta-lists {
  display: flex;
  flex-direction: column;
  gap: var(--s4);
}

.tabs {
  display: flex;
  gap: var(--s1);
}

.tab {
  cursor: pointer;
}

.tab.is-on {
  border-color: currentColor;
  color: var(--accent);
  font-weight: 600;
}

.tab__badge {
  min-width: 16px;
  padding: 0 4px;
  border-radius: var(--rp);
  background: var(--warn);
  color: var(--text-on-accent);
  font-size: 10px;
}

.grid-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--f-sm);
}

.grid-table th,
.grid-table td {
  padding: var(--s2) var(--s3);
  text-align: left;
  border-bottom: 1px solid var(--border);
}

.grid-table th {
  color: var(--text-faint);
  font-weight: 500;
  font-size: var(--f-xs);
}

.num { text-align: right; font-variant-numeric: tabular-nums; }

.has-ai { color: var(--warn); }

.dim { color: var(--text-dim); }

.ops { white-space: nowrap; }

.ops .btn,
.ops :deep(.select) {
  margin-right: var(--s1);
}

.link {
  color: var(--text);
  text-decoration: none;
}

.link:hover { color: var(--accent); }

.input--sm {
  height: var(--ctl-h-xs);
  font-size: var(--f-xs);
}
</style>
