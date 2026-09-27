<template>
  <div class="channels">
    <div class="panel-head">
      <div class="panel-head__text">
        <h3 class="panel-title">抓取通道</h3>
        <p class="panel-desc">
          一条通道 = 一个站点：去哪查、怎么抽字段、要多礼貌。
          限速、每日配额、连续失败熔断都在这一行配 —— 把站点敲封之前，这套闸门会先停下自己。
        </p>
      </div>
      <button class="btn btn--sm btn--primary" @click="create">新建通道</button>
    </div>

    <table class="data-table">
      <thead>
        <tr>
          <th>通道</th><th>对象</th><th>状态</th><th class="num">今日</th><th class="num">间隔</th><th class="ops">操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="c in rows" :key="c.id">
          <td>
            <div>{{ c.name }}</div>
            <div class="dim small">{{ kindLabel(c.fetchKind) }} · 查询词按{{ sourceLabel(c.querySource) }}</div>
          </td>
          <td>{{ c.entity === 'actor' ? '演员' : '影片' }}</td>
          <td>
            <span class="tag" :class="c.usable ? 'tag--success' : 'tag--warn'">{{ c.why }}</span>
            <div v-if="c.lastError" class="dim small">{{ c.lastError }}</div>
          </td>
          <td class="num">{{ c.usedToday }}/{{ c.dailyQuota }}</td>
          <td class="num">{{ (c.minIntervalMs / 1000).toFixed(1) }}s</td>
          <td class="ops">
            <!-- 站点翻脸时先一键关掉，比进对话框翻一圈快；配置原样留着 -->
            <button
              class="btn btn--sm btn--ghost"
              :title="c.enabled ? '停用：抓取遇到这条通道直接跳过，配置与规则都留着' : '启用：恢复向这个站点发请求'"
              @click="toggle(c)"
            >
              {{ c.enabled ? '停用' : '启用' }}
            </button>
            <button class="btn btn--sm btn--ghost" @click="edit(c)">编辑</button>
            <button class="btn btn--sm btn--ghost" @click="test(c)">试抓</button>
            <button
              class="btn btn--sm btn--ghost"
              :disabled="!c.consecutiveFails && !c.blockedUntil && !c.usedToday"
              title="换了 IP 或确认对方放行时用"
              @click="reset(c)"
            >清冷却</button>
            <button class="btn btn--sm btn--danger" @click="remove(c)">删除</button>
          </td>
        </tr>
      </tbody>
    </table>
    <p v-if="!rows.length" class="empty"><span>还没有通道</span></p>

    <!-- 编辑 -->
    <div v-if="draft" class="overlay" @click.self="draft = null">
      <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="ch-title">
        <div class="dialog__head">
          <h3 class="dialog__title" id="ch-title">{{ draft.id ? '编辑通道' : '新建通道' }}</h3>
          <button class="dialog__close" aria-label="关闭" @click="draft = null">&times;</button>
        </div>
        <div class="dialog__body channels__form">
          <label>名称<input v-model="draft.name" class="input" placeholder="例：av-wiki 女优档案" /></label>
          <div class="row2">
            <label>对象
              <SelectList v-model="draft.entity" :options="ENTITY_OPTIONS" label="抓取对象" />
            </label>
            <label>查询词取自
              <SelectList v-model="draft.querySource" :options="SOURCE_OPTIONS" label="查询词来源" />
            </label>
          </div>
          <label>取回类型
            <SelectList v-model="draft.fetchKind" :options="KIND_OPTIONS" label="取回类型" />
          </label>
          <p v-if="draft.fetchKind === 'builtin'" class="hint">
            builtin：抽取逻辑写在代码里（av-wiki 那套「唯一命中且名字对得上才算数」的判定不适合降级成配置），
            这条通道只管开关、限速、配额、熔断。
          </p>
          <template v-else>
            <label>地址模板
              <input v-model="draft.fetchUrl" class="input" placeholder="https://站点/搜索?q={q}" />
            </label>
            <p class="hint">
              占位符：<code>{q}</code> 编码后的查询词 · <code>{raw}</code> 原样 · <code>{slug}</code> 从档案链接里抠出的 slug。
              只收 http(s)。
            </p>
            <div class="row2">
              <label>Referer（可选）<input v-model="draft.referer" class="input" placeholder="https://站点/" /></label>
              <label>User-Agent（可选，留空用内置）<input v-model="draft.userAgent" class="input" /></label>
            </div>

            <div class="rules">
              <div class="rules__head">
                <span>抽取规则</span>
                <button class="btn btn--sm btn--ghost" @click="addRule">加一条</button>
              </div>
              <p class="hint">目标只能从白名单里选 —— 不然配置界面就等于一个任意改库的入口。</p>
              <div v-for="(r, i) in ruleList" :key="i" class="rules__row">
                <select v-model="r.target" class="input" aria-label="写入目标">
                  <option v-for="t in targets" :key="t[0]" :value="t[0]">{{ t[2] }}</option>
                </select>
                <input
                  v-model="r.path"
                  class="input grow"
                  :placeholder="draft.fetchKind === 'json' ? '点路径，如 0.title.rendered' : '正则，取第一个捕获组'"
                />
                <SelectList v-model="r.transform" :options="TRANSFORM_OPTIONS" all-label="不转换" label="转换" />
                <label class="chk">
                  <input v-model="r.ifEmptyOnly" type="checkbox" />只填空值
                </label>
                <button class="btn btn--sm btn--ghost" aria-label="删掉这条规则" @click="ruleList.splice(i, 1)">×</button>
              </div>
            </div>
          </template>

          <div class="row3">
            <label>最小间隔（毫秒）<input v-model.number="draft.minIntervalMs" class="input" type="number" min="200" step="100" /></label>
            <label>每日配额（次）<input v-model.number="draft.dailyQuota" class="input" type="number" min="1" /></label>
            <label>连续失败几次就冷却
              <input v-model.number="draft.failLimit" class="input" type="number" min="1" />
            </label>
          </div>
          <div class="row2">
            <label>冷却多久（分钟）<input v-model.number="draft.cooldownMinutes" class="input" type="number" min="1" /></label>
            <label class="chk chk--box">
              <input v-model="draft.enabled" type="checkbox" />启用这条通道
            </label>
          </div>
          <label>备注<textarea v-model="draft.note" class="input" rows="2"></textarea></label>
        </div>
        <div class="dialog__foot">
          <button class="btn btn--primary" :disabled="busy" @click="save">保存</button>
          <button class="btn btn--ghost" @click="draft = null">取消</button>
        </div>
      </div>
    </div>

    <!-- 试抓：改完当场看到抽出了什么，一个字都不写库 -->
    <div v-if="testing" class="overlay" @click.self="testing = null">
      <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="test-title">
        <div class="dialog__head">
          <h3 class="dialog__title" id="test-title">试抓 · {{ testing.name }}</h3>
          <button class="dialog__close" aria-label="关闭" @click="testing = null">&times;</button>
        </div>
        <div class="dialog__body">
          <p class="panel-desc">
            这会真发一次请求（计入今日配额），但<b>不写任何数据</b>。
            抽出来的值对上了再回列表用「应用」。
          </p>
          <label>查询词
            <input v-model="testQuery" class="input" :placeholder="`例：${testing.querySource === 'code' ? 'ROE-406' : '椎名由奈'}`" />
          </label>
          <div v-if="testResult" class="test-out">
            <p class="test-out__msg" :class="{ bad: !testResult.success }">{{ testResult.message }}</p>
            <dl v-if="testResult.data?.found" class="test-out__list">
              <template v-for="(v, k) in testResult.data.found" :key="k">
                <dt>{{ targetLabel(k) }}</dt><dd>{{ v }}</dd>
              </template>
            </dl>
          </div>
        </div>
        <div class="dialog__foot">
          <button class="btn btn--primary" :disabled="busy || !testQuery.trim()" @click="runTest">
            {{ busy ? '请求中…' : '发一次请求' }}
          </button>
          <button class="btn btn--ghost" @click="testing = null">关闭</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { scrapeApi } from '@/scripts/api'
import { useUiStore, errText } from '@/scripts/store/ui'
import SelectList from '@/views/components/SelectList.vue'

const ui = useUiStore()
const rows = ref([])
const targets = ref([])
const draft = ref(null)
const ruleList = ref([])
const testing = ref(null)
const testQuery = ref('')
const testResult = ref(null)
const busy = ref(false)

const ENTITY_OPTIONS = [{ value: 'video', label: '影片' }, { value: 'actor', label: '演员' }]
const SOURCE_OPTIONS = [
  { value: 'code', label: '番号' },
  { value: 'name', label: '姓名 / 片名' },
  { value: 'slug', label: '已有档案链接里的 slug' }
]
const KIND_OPTIONS = [
  { value: 'json', label: 'JSON 接口（按点路径取值）' },
  { value: 'html', label: '网页（按正则取捕获组）' },
  { value: 'builtin', label: '内置逻辑（只管开关与礼貌）' }
]
const TRANSFORM_OPTIONS = [
  { value: 'jdate', label: '日式日期 → ISO' },
  { value: 'upper', label: '转大写' },
  { value: 'collapse', label: '压掉多余空白' }
]

const kindLabel = (k) => KIND_OPTIONS.find((x) => x.value === k)?.label.split('（')[0] || k
const sourceLabel = (s) => SOURCE_OPTIONS.find((x) => x.value === s)?.label || s
const targetLabel = (t) => targets.value.find((x) => x[0] === t)?.[2] || t

const load = async () => {
  try {
    const res = await scrapeApi.channels()
    if (res.success) {
      rows.value = res.data || []
      targets.value = res.targets || []
    } else ui.error(res.message || '加载失败')
  } catch (err) {
    ui.error('加载失败：' + errText(err))
  }
}

const blank = () => ({
  id: '', name: '', entity: 'video', enabled: true, querySource: 'code',
  fetchUrl: '', fetchKind: 'json', referer: '', userAgent: '',
  minIntervalMs: 1500, dailyQuota: 300, failLimit: 3, cooldownMinutes: 120, note: '', rules: '[]'
})

const create = () => {
  draft.value = blank()
  ruleList.value = [{ target: 'videos.original_name', path: '', transform: '', ifEmptyOnly: true }]
}

const edit = (c) => {
  draft.value = { ...c }
  try {
    ruleList.value = JSON.parse(c.rules || '[]')
  } catch {
    ruleList.value = []
  }
}

const addRule = () => ruleList.value.push({ target: 'videos.original_name', path: '', transform: '', ifEmptyOnly: true })

const save = async () => {
  busy.value = true
  try {
    const body = { ...draft.value, rules: JSON.stringify(ruleList.value) }
    const res = await scrapeApi.saveChannel(body)
    // 校验不过时后端会把所有问题一次说完，别让人一条条试
    if (!res.success) return ui.warn(res.message || '没保存')
    ui.success(res.message)
    draft.value = null
    load()
  } catch (err) {
    ui.error('保存失败：' + errText(err))
  } finally {
    busy.value = false
  }
}

const remove = async (c) => {
  const go = await ui.confirm({
    title: '删除通道',
    message: `「${c.name}」的配置与规则都会消失。已经抓回来的数据不受影响。`,
    confirmLabel: '删除',
    danger: true
  })
  if (!go) return
  const res = await scrapeApi.deleteChannel(c.id)
  ui[res.success ? 'success' : 'error'](res.message || '已删除')
  load()
}

const toggle = async (c) => {
  const res = await scrapeApi.toggleChannel(c.id)
  ui[res.success ? 'success' : 'error'](res.message || '没改成')
  load()
}

const reset = async (c) => {
  const res = await scrapeApi.resetChannel(c.id)
  ui[res.success ? 'success' : 'error'](res.message || '已清除')
  load()
}

const test = (c) => {
  testing.value = c
  testQuery.value = ''
  testResult.value = null
}

const runTest = async () => {
  busy.value = true
  try {
    testResult.value = await scrapeApi.testChannel(testing.value.id, { q: testQuery.value.trim() })
    load()   // 今日计数变了，列表要跟上
  } catch (err) {
    testResult.value = { success: false, message: '请求失败：' + errText(err) }
  } finally {
    busy.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.channels {
  display: flex;
  flex-direction: column;
  gap: var(--s3);
}

.channels__form {
  display: flex;
  flex-direction: column;
  gap: var(--s3);
}

.channels__form label {
  display: flex;
  flex-direction: column;
  gap: var(--s1);
  font-size: var(--f-sm);
  color: var(--text-dim);
}

.row2,
.row3 {
  display: grid;
  gap: var(--s3);
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.row3 {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.hint {
  margin: 0;
  font-size: var(--f-xs);
  color: var(--text-faint);
  line-height: 1.6;
}

.hint code {
  padding: 0 3px;
  border-radius: 3px;
  background: var(--bg-elev-2);
}

.chk {
  flex-direction: row;
  align-items: center;
  gap: var(--s2);
}

.chk--box {
  align-self: end;
  height: var(--ctl-h);
}

.rules {
  display: flex;
  flex-direction: column;
  gap: var(--s2);
  padding: var(--s3);
  border: 1px solid var(--border);
  border-radius: var(--r2);
}

.rules__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: var(--f-sm);
}

.rules__row {
  display: flex;
  align-items: center;
  gap: var(--s2);
}

.rules__row .input {
  min-width: 0;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--f-sm);
}

.data-table th,
.data-table td {
  padding: var(--s2) var(--s3);
  text-align: left;
  border-bottom: 1px solid var(--border);
  vertical-align: top;
}

.data-table th {
  color: var(--text-faint);
  font-weight: 500;
  font-size: var(--f-xs);
}

.num {
  text-align: right;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.dim { color: var(--text-dim); }
.small { font-size: var(--f-xs); }

.ops { white-space: nowrap; }
.ops .btn { margin-right: var(--s1); }

.test-out {
  margin-top: var(--s3);
  padding: var(--s3);
  border: 1px solid var(--border);
  border-radius: var(--r2);
  background: var(--bg-elev);
}

.test-out__msg { margin: 0 0 var(--s2); font-size: var(--f-sm); }
.test-out__msg.bad { color: var(--danger); }

.test-out__list {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: var(--s1) var(--s3);
  margin: 0;
  font-size: var(--f-sm);
}

.test-out__list dt { color: var(--text-faint); }
.test-out__list dd { margin: 0; word-break: break-all; }
</style>
