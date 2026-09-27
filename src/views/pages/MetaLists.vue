<template>
  <div class="meta-lists" :class="embedded ? 'meta-lists--embedded' : 'page'">
    <div class="meta-lists__head">
      <h1 v-if="!embedded" class="page-title">词表管理</h1>
      <div v-if="shownTabs.length > 1" class="tabs" role="tablist">
        <button
          v-for="t in shownTabs"
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

    <!-- 新建：标签只缺一个名字，行内输入就够；片商有四个字段，走对话框 -->
    <div v-if="tab !== 'pending'" class="filters">
      <template v-if="tab === 'tag'">
        <input v-model="newName" class="input grow" placeholder="新标签名" @keyup.enter="create" />
        <button class="btn btn--sm btn--primary" :disabled="!newName.trim() || busy" @click="create">添加</button>
        <button
          v-if="picked.length"
          class="btn btn--sm btn--danger"
          :disabled="busy"
          @click="removePicked"
        >
 删除选中（{{ picked.length }}）
</button>
      </template>
      <button v-else class="btn btn--sm btn--primary" @click="openStudio(null)">添加片商</button>
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
        <tr>
          <th class="chk">
            <input
              type="checkbox"
              aria-label="全选本页"
              :checked="allOnPage"
              :indeterminate.prop="someOnPage && !allOnPage"
              @change="toggleAll"
            />
          </th>
          <th>标签</th><th>别名</th><th class="num">影片</th><th class="num">AI 打的</th><th class="ops">操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="t in rows" :key="t.id" :class="{ 'is-picked': picked.includes(t.id) }">
          <td class="chk">
            <input type="checkbox" :aria-label="`选择标签 ${t.name}`" :checked="picked.includes(t.id)" @change="togglePick(t)" />
          </td>
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
        <tr><th>片商</th><th>别名</th><th>国家</th><th>官网</th><th class="num">影片</th><th class="ops">操作</th></tr>
      </thead>
      <tbody>
        <tr v-for="s in rows" :key="s.id">
          <td>{{ s.name }}</td>
          <td class="dim">{{ s.aliases.join('、') || '—' }}</td>
          <td class="dim">{{ s.country || '—' }}</td>
          <td>
            <a v-if="s.link" class="link" :href="s.link" target="_blank" rel="noreferrer">官网</a>
            <span v-else class="dim">—</span>
          </td>
          <td class="num">{{ s.videoCount }}</td>
          <td class="ops">
            <button class="btn btn--sm btn--ghost" @click="openStudio(s)">编辑</button>
            <button class="btn btn--sm btn--danger" @click="askDelete(s)">删除</button>
          </td>
        </tr>
      </tbody>
    </table>

    <!-- AI 候选队列：一个词一行。同一个词常常是几部片各提一条，
         逐条批准要点好几次，而判断只是"这个词要不要进词表" -->
    <div v-else>
      <div v-if="!groups.length" class="empty"><p>待审队列是空的</p></div>
      <table v-else class="grid-table grid-table--sugg">
        <thead>
          <tr><th>候选词</th><th>提它的片</th><th>依据</th><th class="ops">处理</th></tr>
        </thead>
        <tbody>
          <tr v-for="g in groups" :key="g.name">
            <td class="word"><strong>{{ g.name }}</strong></td>
            <td class="films">
              <span v-for="r in g.rows" :key="r.id" class="film" :title="r.note || ''">
                <router-link :to="`/video/${r.videoId}`" class="link">{{ r.videoCode || r.videoName || '该片' }}</router-link>
                <button type="button" class="film__drop" :aria-label="`只驳回 ${r.videoCode || '该片'} 这一条`" @click="rejectOne(r)">&times;</button>
              </span>
            </td>
            <td class="dim">{{ g.notes.join(' / ') || '—' }}</td>
            <td class="ops">
              <div class="ops-row">
                <button class="btn btn--sm" :disabled="busy" @click="resolve(g, 'approve')">
                  批准（{{ g.rows.length }} 部）
                </button>
                <button class="btn btn--sm btn--ghost" :disabled="busy" @click="resolve(g, 'reject')">驳回</button>
              </div>
              <SelectList
                v-model="mergeTarget[g.name]"
                :options="rows2Options"
                all-label="并入已有标签…"
                :label="`把「${g.name}」并入已有标签`"
                class="ops-merge"
                @change="mergeInto(g)"
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <Pagination v-if="tab !== 'pending'" v-model:page="page" :page-size="pageSize" :total="total" @change="load" />

    <!-- 片商表单：正名 + 别名 + 国家 + 官网，四个字段一起给，
         因为抓取通道只会填正名，剩下的补齐只能在这里 -->
    <Dialog
      :visible="showStudio"
      :title="editingStudio ? `编辑片商「${editingStudio.name}」` : '添加片商'"
      size="sm"
      @cancel="showStudio = false"
    >
      <template #content>
        <div class="form">
          <div class="field">
            <label for="st-name">正名 <span class="req">*</span></label>
            <input id="st-name" v-model="studioForm.name" class="input" maxlength="60" placeholder="如：プレステージ" />
          </div>
          <div class="field">
            <span class="field__label">别名</span>
            <ChipListEditor
              v-model="studioForm.aliases"
              label="片商别名"
              placeholder="如：Prestige、マドンナ社，回车添加"
              empty-text="暂无别名"
              hint="搜索与抓取归一时别名也算命中；与正名重复的会被自动丢掉"
            />
          </div>
          <div class="field">
            <span class="field__label">国家</span>
            <SelectList
              v-model="studioForm.country"
              :options="countryOptions"
              label="选择国家"
              all-label="（未填）"
              placeholder="选择国家"
            />
          </div>
          <div class="field">
            <label for="st-link">官网</label>
            <input id="st-link" v-model="studioForm.link" class="input" maxlength="300" placeholder="https://…（可留空）" />
          </div>
        </div>
      </template>

      <!-- 自带确认按钮会先关窗再发事件，名称为空时人就跑了，所以自己放一对 -->
      <template #actions>
        <button type="button" class="btn" @click="showStudio = false">取消</button>
        <button type="button" class="btn btn--primary" :disabled="busy || !studioForm.name.trim()" @click="saveStudio">
          {{ busy ? '保存中…' : '保存' }}
        </button>
      </template>
    </Dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { tagApi, studioApi, actorApi } from '@/scripts/api'
import { useAppStore } from '@/scripts/store/app'
import { useUiStore, errText } from '@/scripts/store/ui'
import { toOptions } from '@/scripts/utils/options'
import { debounce } from '@/scripts/utils/debounce'
import Pagination from '@/views/components/Pagination.vue'
import SelectList from '@/views/components/SelectList.vue'
import ChipListEditor from '@/views/components/ChipListEditor.vue'
import Dialog from '@/views/components/Dialog.vue'

/**
 * 嵌进设置页时不要自己的页头与页面级留白，只留标签条和表格。
 * tabs 决定这一份露出哪几个词表：设置里「题材标签」与「片商」是两个分区，
 * 各自只挂自己那一份，所以片商那边传 ['studio']，标签那边传 ['tag','pending']。
 */
const props = defineProps({
  embedded: { type: Boolean, default: false },
  tabs: { type: Array, default: () => ['tag', 'studio', 'pending'] }
})

const TABS = [
  { key: 'tag', label: '题材标签' },
  { key: 'studio', label: '片商' },
  { key: 'pending', label: 'AI 候选待审' }
]

const app = useAppStore()
const ui = useUiStore()

const shownTabs = computed(() => TABS.filter((t) => props.tabs.includes(t.key)))
const tab = ref(shownTabs.value[0]?.key || 'tag')
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
// 批量删标签的勾选集：跨页留着（翻页不该把人刚勾的清空），切标签页或删完才清
const picked = ref([])

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
      pendingCount.value = new Set((res.data || []).map((x) => x.name)).size
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
  picked.value = []
  load()
}

const pageIds = computed(() => rows.value.map((r) => r.id))
const allOnPage = computed(() => pageIds.value.length > 0 && pageIds.value.every((id) => picked.value.includes(id)))
const someOnPage = computed(() => pageIds.value.some((id) => picked.value.includes(id)))

const togglePick = (row) => {
  picked.value = picked.value.includes(row.id)
    ? picked.value.filter((id) => id !== row.id)
    : [...picked.value, row.id]
}

const toggleAll = () => { picked.value = allOnPage.value ? [] : [...pageIds.value] }

/** 一次删十几个是常态（AI 跑完一轮要清场），所以影响面在确认框里算清楚再动手 */
const removePicked = async () => {
  const chosen = rows.value.filter((r) => picked.value.includes(r.id))
  const films = chosen.reduce((n, r) => n + (r.videoCount || 0), 0)
  const names = chosen.slice(0, 6).map((r) => r.name).join('、') + (chosen.length > 6 ? ` 等 ${chosen.length} 个` : '')
  const go = await ui.confirm({
    title: `删除 ${chosen.length} 个标签`,
    message: `${names} 会从词表里消失，${films} 部影片上的这些挂接也一并摘掉（按标签浏览会少这些入口）。这一步不能撤销。`,
    confirmLabel: '删除',
    danger: true
  })
  if (!go) return
  busy.value = true
  try {
    const res = await tagApi.batchDelete(picked.value)
    if (res.success) {
      picked.value = []
      ui.success(res.message)
      load()
    } else ui.error(res.message || '删除失败')
  } catch (err) {
    ui.error('失败：' + errText(err))
  } finally {
    busy.value = false
  }
}

const create = async () => {
  const name = newName.value.trim()
  if (!name) return
  busy.value = true
  try {
    const res = await tagApi.add({ name })
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
  const res = await tagApi.update(row.id, { name })
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

/** 一个词一行：同名候选合并成一组，依据去重后并排显示 */
const groups = computed(() => {
  const map = new Map()
  for (const r of suggestions.value) {
    if (!map.has(r.name)) map.set(r.name, { name: r.name, rows: [], notes: [] })
    const g = map.get(r.name)
    g.rows.push(r)
    if (r.note && !g.notes.includes(r.note)) g.notes.push(r.note)
  }
  return [...map.values()]
})

/** 批准 / 并入 / 全部驳回都按词提交，一次点完这个词 */
const resolve = async (g, action, tagId = null) => {
  busy.value = true
  try {
    const res = await tagApi.resolve(g.name, action, tagId)
    ui[res.success ? 'success' : 'error'](res.message || '没成功')
    if (res.success) loadSuggestions()
  } catch (err) {
    ui.error('失败：' + errText(err))
  } finally {
    busy.value = false
  }
}

const mergeInto = (g) => {
  const target = mergeTarget.value[g.name]
  if (!target) return
  mergeTarget.value[g.name] = ''
  resolve(g, 'merge', target)
}

/** 词留着，只把这一部片从队列里摘掉 */
const rejectOne = async (sg) => {
  const res = await tagApi.reject(sg.id)
  ui[res.success ? 'success' : 'error'](res.message || '没成功')
  if (res.success) loadSuggestions()
}

/* ---------------------------------------------------------------
   片商表单
   --------------------------------------------------------------- */

const showStudio = ref(false)
const editingStudio = ref(null)
const studioForm = ref({ name: '', aliases: [], country: '', link: '' })
const countries = ref([])

const countryOptions = computed(() => toOptions(countries.value, studioForm.value.country))

/** 只填了个 example.com 也要能点：缺协议就补 https://，否则链接会指向本站 */
const withScheme = (value) => {
  const v = (value || '').trim()
  return v && !/^https?:\/\//i.test(v) ? `https://${v}` : v
}

const openStudio = async (row) => {
  editingStudio.value = row || null
  studioForm.value = row
    ? { name: row.name, aliases: [...(row.aliases || [])], country: row.country || '', link: row.link || '' }
    : { name: '', aliases: [], country: '', link: '' }
  showStudio.value = true
  if (!countries.value.length) {
    try {
      const res = await actorApi.getCountries()
      if (res.success) countries.value = res.data || []
    } catch (err) {
      console.error('加载国家清单失败:', err)
    }
  }
}

const saveStudio = async () => {
  const name = studioForm.value.name.trim()
  if (!name) return ui.warn('片商名不能为空')
  busy.value = true
  try {
    const payload = {
      name,
      aliases: studioForm.value.aliases,
      country: studioForm.value.country,
      link: withScheme(studioForm.value.link)
    }
    const res = editingStudio.value
      ? await studioApi.update(editingStudio.value.id, payload)
      : await studioApi.add(payload)
    if (res.success) {
      showStudio.value = false
      ui.success(res.message)
      load()
    } else ui.warn(res.message || '没保存')
  } catch (err) {
    ui.error('保存失败：' + errText(err))
  } finally {
    busy.value = false
  }
}

onMounted(async () => {
  await load()
  // 角标要在别的标签页也看得见，所以进页面先摸一次待审数
  const s = await tagApi.suggestions({ status: 'pending' }).catch(() => null)
  if (s?.success) pendingCount.value = new Set((s.data || []).map((x) => x.name)).size
})
</script>

<style scoped>
.meta-lists {
  display: flex;
  flex-direction: column;
  gap: var(--s4);
}

/* 独立成页时靠 .page 的留白，嵌进设置分区就贴着面板自己的间距 */
.meta-lists--embedded {
  gap: var(--s3);
}

.meta-lists__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--s3);
  flex-wrap: wrap;
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

.form {
  display: flex;
  flex-direction: column;
  gap: var(--s4);
}

.req {
  color: var(--danger);
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

/* 勾选列：窄、居中，尺寸与卡片上的选择框同一档 */
.chk { width: 34px; text-align: center; }

.chk input[type="checkbox"] {
  width: 18px;
  height: 18px;
  accent-color: var(--accent);
  cursor: pointer;
}

tr.is-picked td { background: var(--bg-elev-2); }

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

/* 候选队列表格：依据那段话很长，默认自动布局会把"候选词"挤成一字一行，
   所以列宽写死（table-layout: fixed），只让依据列吃剩余宽度 */
.grid-table--sugg {
  table-layout: fixed;
}

.grid-table--sugg th:nth-child(1),
.grid-table--sugg td:nth-child(1) { width: 88px; }

.grid-table--sugg th:nth-child(2),
.grid-table--sugg td:nth-child(2) { width: 200px; }

.grid-table--sugg th:last-child,
.grid-table--sugg td:last-child { width: 176px; }

.word {
  white-space: nowrap;
  overflow-wrap: normal;
}

/* 一个候选词来自哪几部片：放不下自动换行，每条后面带一个只摘它自己的 × */
.films {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s1) var(--s2);
  color: var(--text-dim);
}

.film {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

.film__drop {
  display: grid;
  place-items: center;
  width: 16px;
  height: 16px;
  border-radius: var(--rp);
  color: var(--text-faint);
  font-size: var(--f-md);
  line-height: 1;
  cursor: pointer;
}

.film__drop:hover {
  color: var(--danger);
  background: var(--bg-hover);
}

/* 处理列：两个按钮一行，并入的下拉单独一行（它是整宽的，挤在一起会撑破列） */
.ops-row {
  display: flex;
  gap: var(--s1);
}

.ops-merge {
  display: block;
  margin-top: var(--s1);
}

.input--sm {
  height: var(--ctl-h-xs);
  font-size: var(--f-xs);
}
</style>
