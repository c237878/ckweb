<template>
  <div class="studio-lists" :class="embedded ? 'studio-lists--embedded' : 'page'">
    <h1 v-if="!embedded" class="page-title">片商管理</h1>

    <div class="filters">
      <button class="btn btn--sm btn--primary" @click="open(null)">添加片商</button>
      <input
        v-model="keyword"
        class="input grow"
        type="search"
        placeholder="搜索名称、别名或官网域名…"
        @keyup.enter="applyFilter"
        @input="debouncedFilter"
      />
      <SelectList
        v-model="country"
        :options="countryFilterOptions"
        all-label="全部国家"
        label="按国家筛选"
        @change="applyFilter"
      />
    </div>

    <table class="grid-table">
      <thead>
        <tr>
            <th>片商</th><th class="col-alias">别名</th><th>国家</th><th>官网</th>
            <th class="num">影片</th><th class="ops">操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="s in rows" :key="s.id">
          <td>{{ s.name }}</td>
          <td class="dim col-alias">{{ s.aliases.join('、') || '—' }}</td>
          <td class="dim">{{ s.country || '—' }}</td>
          <td>
            <a v-if="s.link" class="link" :href="s.link" target="_blank" rel="noreferrer">官网</a>
            <span v-else class="dim">—</span>
          </td>
          <td class="num">{{ s.videoCount }}</td>
          <td class="ops">
            <button class="btn btn--sm btn--ghost" @click="open(s)">编辑</button>
            <button class="btn btn--sm btn--danger" @click="askDelete(s)">删除</button>
          </td>
        </tr>
      </tbody>
    </table>
    <p v-if="!rows.length" class="empty">
      <span>{{ keyword || country ? '没有符合条件的片商' : '还没有片商' }}</span>
      <button v-if="keyword || country" class="btn btn--sm btn--ghost" @click="clearFilters">清除筛选</button>
    </p>

    <Pagination v-model:page="page" :page-size="pageSize" :total="total" @change="load" />

    <!-- 片商表单：正名 + 别名 + 国家 + 官网，四个字段一起给，
         因为抓取通道只会填正名，剩下的补齐只能在这里 -->
    <Dialog
      :visible="show"
      :title="editing ? `编辑片商「${editing.name}」` : '添加片商'"
      size="sm"
      @cancel="show = false"
    >
      <template #content>
        <div class="form">
          <div class="field">
            <label for="st-name">正名 <span class="req">*</span></label>
            <input id="st-name" v-model="form.name" class="input" maxlength="60" placeholder="如：プレステージ" />
          </div>
          <div class="field">
            <span class="field__label">别名</span>
            <ChipListEditor
              v-model="form.aliases"
              label="片商别名"
              placeholder="如：Prestige、マドンナ社，回车添加"
              empty-text="暂无别名"
              hint="搜索与抓取归一时别名也算命中；与正名重复的会被自动丢掉"
            />
          </div>
          <div class="field">
            <span class="field__label">国家</span>
            <SelectList
              v-model="form.country"
              :options="countryOptions"
              label="选择国家"
              all-label="（未填）"
              placeholder="选择国家"
            />
          </div>
          <div class="field">
            <label for="st-link">官网</label>
            <input id="st-link" v-model="form.link" class="input" maxlength="300" placeholder="https://…（可留空）" />
          </div>
        </div>
      </template>

      <!-- 自带确认按钮会先关窗再发事件，名称为空时人就跑了，所以自己放一对 -->
      <template #actions>
        <button type="button" class="btn" @click="show = false">取消</button>
        <button type="button" class="btn btn--primary" :disabled="busy || !form.name.trim()" @click="save">
          {{ busy ? '保存中…' : '保存' }}
        </button>
      </template>
    </Dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { studioApi, actorApi } from '@/scripts/api'
import { useAppStore } from '@/scripts/store/app'
import { useUiStore, errText } from '@/scripts/store/ui'
import { toOptions } from '@/scripts/utils/options'
import { debounce } from '@/scripts/utils/debounce'
import Pagination from '@/views/components/Pagination.vue'
import SelectList from '@/views/components/SelectList.vue'
import ChipListEditor from '@/views/components/ChipListEditor.vue'
import Dialog from '@/views/components/Dialog.vue'

/** 嵌进设置分区时不要自己的页头与页面级留白 */
defineProps({ embedded: { type: Boolean, default: false } })

const app = useAppStore()
const ui = useUiStore()

const rows = ref([])
const total = ref(0)
const page = ref(1)
const keyword = ref('')
const country = ref('')
const busy = ref(false)
// 只列词表里真用过的国家（当前是日本 / 中国）：把整张地区清单搬过来会有一堆点开是空结果
const usedCountries = ref([])
const countryFilterOptions = computed(() => usedCountries.value.map((c) => ({ value: c, label: c })))

const pageSize = computed(() => app.pageSize)

const load = async () => {
  try {
    const res = await studioApi.getList({
      page: page.value,
      pageSize: pageSize.value,
      keyword: keyword.value,
      country: country.value
    })
    if (res.success) {
      rows.value = res.data || []
      total.value = res.total || 0
    } else ui.error(res.message || '加载失败')
  } catch (err) {
    ui.error('加载失败：' + errText(err))
  }
}

/** 换了关键词或国家都回到第一页：停在第 3 页改筛选条件，看到的是空结果 */
const applyFilter = () => {
  page.value = 1
  load()
}

const debouncedFilter = debounce(applyFilter, 400)

const clearFilters = () => {
  keyword.value = ''
  country.value = ''
  applyFilter()
}

const loadCountries = async () => {
  try {
    const res = await studioApi.getCountries()
    if (res.success) usedCountries.value = res.data || []
  } catch (err) {
    console.error('加载片商国家列表失败:', err)
  }
}

/* ---------------------------------------------------------------
   片商表单
   --------------------------------------------------------------- */

const show = ref(false)
const editing = ref(null)
const form = ref({ name: '', aliases: [], country: '', link: '' })
const countries = ref([])

const countryOptions = computed(() => toOptions(countries.value, form.value.country))

/** 只填了个 example.com 也要能点：缺协议就补 https://，否则链接会指向本站 */
const withScheme = (value) => {
  const v = (value || '').trim()
  return v && !/^https?:\/\//i.test(v) ? `https://${v}` : v
}

const open = async (row) => {
  editing.value = row || null
  form.value = row
    ? { name: row.name, aliases: [...(row.aliases || [])], country: row.country || '', link: row.link || '' }
    : { name: '', aliases: [], country: '', link: '' }
  show.value = true
  if (!countries.value.length) {
    try {
      const res = await actorApi.getCountries()
      if (res.success) countries.value = res.data || []
    } catch (err) {
      console.error('加载国家清单失败:', err)
    }
  }
}

const save = async () => {
  const name = form.value.name.trim()
  if (!name) return ui.warn('片商名不能为空')
  busy.value = true
  try {
    const payload = {
      name,
      aliases: form.value.aliases,
      country: form.value.country,
      link: withScheme(form.value.link)
    }
    const res = editing.value
      ? await studioApi.update(editing.value.id, payload)
      : await studioApi.add(payload)
    if (res.success) {
      show.value = false
      ui.success(res.message)
      load()
    } else ui.warn(res.message || '没保存')
  } catch (err) {
    ui.error('保存失败：' + errText(err))
  } finally {
    busy.value = false
  }
}

const askDelete = async (row) => {
  const go = await ui.confirm({
    title: '删除片商',
    message: `「${row.name}」会从词表里消失，${row.videoCount} 部影片上的这一项也会一并摘掉。`,
    confirmLabel: '删除',
    danger: true
  })
  if (!go) return
  const res = await studioApi.remove(row.id)
  ui[res.success ? 'success' : 'error'](res.message || (res.success ? '已删除' : '删除失败'))
  if (res.success) load()
}

onMounted(() => {
  loadCountries()
  load()
})
</script>

<style scoped>
.studio-lists {
  display: flex;
  flex-direction: column;
  gap: var(--s4);
}

/* 独立成页时靠 .page 的留白，嵌进设置分区就贴着面板自己的间距 */
.studio-lists--embedded {
  gap: var(--s3);
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

.dim { color: var(--text-dim); }

.ops { white-space: nowrap; }

.link {
  color: var(--text);
  text-decoration: none;
}

.link:hover { color: var(--accent); }

/* 窄屏下别名整列收起来：它是这张表里最宽的一列（一串日文长名），
   挤得右边的「操作」直接被面板边缘裁掉、删除点不到。
   别名在编辑框里看得到也改得了，收掉的只是这一处的显示 */
@media (max-width: 899px) {
  .col-alias {
    display: none;
  }

  /* 表头与短值都别拆成两行：列本来就窄，"国/家"、"日/本"竖着排比列宽更难看。
     片商名长，仍允许换行 */
  .grid-table th,
  .grid-table td:not(:first-child) {
    white-space: nowrap;
  }
}
</style>
