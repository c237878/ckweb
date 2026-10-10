<template>
  <div class="optimize">
    <div class="panel-head">
      <div class="panel-head__text">
        <h3 class="panel-title">文件分析</h3>
        <p class="panel-desc">
          两件事放一起：按「编码 + 时长 + 大小」算平均码率，看哪些文件还值得重编码；按文件内容指纹，
          看哪些文件其实是同一份东西。前者挑出来是要搬去重编码的，后者挑出来是要留一条删一条的。
          排序按"折到目标码率能省下多少"而不是体积 —— 只看体积会挑错对象：同样 6 GB，
          一小时的片还有压缩空间，两小时的片多半已经压到底了。
          分析这两趟都只读库、不碰盘上文件；只有下面勾选之后点「搬移」那一步才会真的动文件，
          而且必须先预检看清清单。
        </p>
      </div>
      <button class="btn btn--sm btn--ghost" :disabled="loading" @click="load()">重新计算</button>
    </div>

    <div class="filters">
      <label for="opt-mbps">目标码率
        <input id="opt-mbps" v-model.number="form.targetMbps" class="input" type="number"
               min="0.25" max="50" step="0.25" @change="load()" />
      </label>
      <label for="opt-min">最小体积（GB）
        <input id="opt-min" v-model.number="form.minSizeGb" class="input" type="number"
               min="0" max="200" step="0.5" @change="load()" />
      </label>
      <label>范围
        <SelectList v-model="form.scope" :options="SCOPE_OPTIONS" label="算哪些文件" @change="load()" />
      </label>
      <label>编码
        <SelectList v-model="form.codec" :options="CODEC_OPTIONS" all-label="全部编码" label="按编码筛选" @change="load()" />
      </label>
      <label class="chk chk--box">
        <input v-model="form.skipLiked" type="checkbox" @change="load()" />排除点赞过的那部
      </label>
    </div>

    <p v-if="error" class="notice notice--error" role="status">{{ error }}</p>

    <template v-if="d">
      <!-- 覆盖率必须先自报：没扫到时长的行根本不参与计算，否则空列表会被读成"没有可压的片" -->
      <div class="cards">
        <div class="card">
          <div class="card__v">{{ d.summary.files }}</div>
          <div class="card__l">参与计算的文件</div>
        </div>
        <div class="card">
          <div class="card__v">{{ gb(d.summary.totalSize) }}</div>
          <div class="card__l">它们的合计体积</div>
        </div>
        <div class="card card--hi">
          <div class="card__v">{{ d.summary.candidateCount }} 个</div>
          <div class="card__l">高于 {{ d.targetMbps }} Mbps · 可省约 {{ gb(d.summary.saveable) }}</div>
        </div>
        <div class="card" :class="{ 'card--warn': d.summary.unscored > 0 }">
          <div class="card__v">{{ d.summary.unscored }}</div>
          <div class="card__l">
            没扫到时长、未参与{{ d.summary.unscored ? `（${gb(d.summary.unscoredSize)}）` : '' }}
            <div v-if="d.summary.unscored" class="dim small">到影片列表点一次「扫描片源」就能补上</div>
          </div>
        </div>
      </div>

      <div class="breakdown">
        <div class="table-wrap">
        <table class="data-table">
          <caption class="cap">按编码</caption>
          <thead><tr><th>编码</th><th class="num">个数</th><th class="num">平均码率</th><th class="num">体积</th><th class="num">可省</th></tr></thead>
          <tbody>
            <tr v-for="b in d.summary.byCodec" :key="b.bucket">
              <td>{{ b.bucket }}</td>
              <td class="num">{{ b.count }}</td>
              <td class="num">{{ b.avgMbps.toFixed(2) }}</td>
              <td class="num">{{ gb(b.size) }}</td>
              <td class="num">{{ gb(b.saveable) }}</td>
            </tr>
          </tbody>
        </table>
        </div>

        <div class="table-wrap">
        <table class="data-table">
          <caption class="cap">按平均码率分段</caption>
          <thead><tr><th>Mbps</th><th class="num">个数</th><th class="num">体积</th></tr></thead>
          <tbody>
            <tr v-for="b in d.summary.byBand" :key="b.band">
              <td>{{ bandLabel(b.band) }}</td>
              <td class="num">{{ b.count }}</td>
              <td class="num">{{ gb(b.size) }}</td>
            </tr>
          </tbody>
        </table>
        </div>
      </div>

      <!-- 搬移是批次级动作，进度得离开弹窗也看得见：跨卷拷几个 GB 是十分钟到小时级的活，
           中途关掉对话框不该看不到它走到哪了 -->
      <JobBar v-if="relRunning && !showRelocate" :text="relText" :percent="relJob.percent" />

      <div class="ops">
        <label class="chk">
          <input type="checkbox" :checked="allChecked" @change="toggleAll" />全选本页
        </label>
        <button class="btn btn--sm btn--ghost" :disabled="!selected.length" @click="copyPaths(selected)">
          复制选中 {{ selected.length }} 个路径
        </button>
        <button class="btn btn--sm btn--ghost" :disabled="!d.items.length" @click="copyPaths(d.items)">
          复制本页 {{ d.items.length }} 个路径
        </button>
        <button class="btn btn--sm btn--ghost" :disabled="!selected.length" @click="copyCsv">
          复制选中 {{ selected.length }} 行为 CSV
        </button>
        <button class="btn btn--sm btn--primary" :disabled="!selected.length && !relRunning" @click="openRelocate">
          {{ relRunning ? '搬移中 · 看进度' : `搬移选中的 ${selected.length} 个…` }}
        </button>
      </div>

      <div class="table-wrap">
        <table class="data-table cand">
          <thead>
            <tr>
              <th></th><th>番号</th><th>片名</th><th>编码</th><th class="num">分辨率</th>
              <th class="num">时长</th><th class="num">体积</th><th class="num">码率</th><th class="num">可省</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in d.items" :key="r.fileId">
              <td><input type="checkbox" :value="r.fileId" v-model="selected" aria-label="选择这一行" /></td>
              <td>
                <router-link :to="`/video/${r.videoId}`">{{ r.videoCode }}</router-link>
                <div v-if="r.fileCode !== r.videoCode" class="dim small">行 {{ r.fileCode }}</div>
              </td>
              <td class="ellip" :title="r.videoName">
                {{ r.videoName }}
                <span v-if="r.liked" class="tag tag--like tag--xs">♥</span>
              </td>
              <td>{{ codecLabel(r.codec) || '—' }}</td>
              <td class="num">{{ r.resW && r.resH ? `${r.resW}×${r.resH}` : '—' }}</td>
              <td class="num">{{ formatDuration(r.duration) || '—' }}</td>
              <td class="num">{{ gb(r.size) }}</td>
              <td class="num" :class="{ 'is-high': r.mbps > d.targetMbps }">{{ r.mbps.toFixed(2) }}</td>
              <td class="num strong">{{ gb(r.saveable) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-if="!d.items.length && !loading" class="empty"><span>这个条件下没有可压缩的文件</span></p>

      <Pagination v-model:page="page" :page-size="pageSize" :total="d.total" @change="load()" />
      <p class="hint">
        码率是<strong>整片平均</strong>（大小 × 8 ÷ 时长），里面含音轨开销（一般 0.1~0.3 Mbps），
        所以目标码率压到 2 Mbps 以下时"可省"会开始虚高。真正的逐段码率、GOP、B 帧这些要读完整张样本表，
        在挂载卷上不划算，也没存。
      </p>
    </template>

    <!-- 内容重复：判据是"头 64KB + 尾 64KB + 体积"的指纹，跟上面那套按码率挑的是两回事，
         所以单独一块，只在真有结果或还没全库扫完指纹时出现，空面板不多占一块地方 -->
    <div v-if="dupes && (dupes.groupCount || dupes.fingerprinted)" class="dupes">
      <div class="dupes__head">
        <span class="tag" :class="dupes.groupCount ? 'tag--warn' : 'tag--success'">
          {{ dupes.groupCount ? `疑似重复 ${dupes.groupCount} 组` : '没有发现内容相同的文件' }}
        </span>
        <span class="meta">已算指纹 {{ dupes.fingerprinted }} / {{ dupes.filesWithContent }} 个文件{{ dupes.fingerprinted < dupes.filesWithContent ? '（没扫到的那部分不参与判断）' : '' }}</span>
      </div>
      <div v-for="g in dupes.groups.slice(0, 8)" :key="g.fingerprint" class="dupe-group">
        <span class="meta">指纹 {{ g.fingerprint.slice(0, 18) }}…</span>
        <div v-for="f in g.files" :key="f.fileId" class="dupe-file">
          <router-link :to="`/video/${f.videoId}`" class="dim">{{ f.videoCode }}</router-link>
          <span>{{ f.videoName }}</span>
          <span class="meta">{{ gb(f.size) }}</span>
          <span class="dim dupe-path" :title="f.path">{{ f.path }}</span>
        </div>
      </div>
      <p class="hint">这里只列证据：留哪一条、要不要删，得人来定。</p>
    </div>

    <!-- 搬移文件：这是本面板唯一一个会动盘上真实文件的动作，所以三步走 ——
         填目标 → 预检（一份"要动哪几个、哪几个不能动以及为什么"）→ 才让点执行。
         预检和执行走的是后端同一段判定，看到的就是会发生的 -->
    <div v-if="showRelocate" class="overlay" @click.self="showRelocate = false">
      <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="rel-title">
        <div class="dialog__head">
          <h3 class="dialog__title" id="rel-title">
            {{ relRunning ? '正在搬移文件' : `搬移选中的 ${selected.length} 个文件` }}
          </h3>
          <button class="dialog__close" aria-label="关闭" @click="showRelocate = false">&times;</button>
        </div>

        <div class="dialog__body">
          <template v-if="relRunning">
            <JobBar :text="relText" :percent="relJob.percent" />
            <p class="hint">
              一次只搬一个，按顺序来 —— 不可逆的批量动作，说清"现在在弄哪一个、哪一个没弄成"比快重要。
              中途关这个窗口不影响任务，它在后端继续跑。
            </p>
          </template>

          <template v-else>
            <label class="fld" for="opt-dest">目标目录
              <input id="opt-dest" v-model="dest" class="input" type="text" spellcheck="false"
                     placeholder="绝对路径，且得已经存在，例如 /Volumes/external/to-encode" />
            </label>

            <div class="mode">
              <label class="chk">
                <input v-model="mode" type="radio" name="opt-rel-mode" value="move" />移动（搬走，库里跟着指向新位置）
              </label>
              <label class="chk">
                <input v-model="mode" type="radio" name="opt-rel-mode" value="copy" />复制（只拷一份过去，库里仍指原文件）
              </label>
            </div>

            <p v-if="plan" class="summary">
              可{{ modeName }} <strong>{{ plan.okCount }}</strong> 个 · 合计 {{ gb(plan.totalSize) }}
              <template v-if="plan.skipCount"> · 跳过 {{ plan.skipCount }} 个</template>
            </p>
            <p v-for="(p, i) in plan?.problems || []" :key="'p' + i" class="notice notice--error">{{ p }}</p>

            <ul v-if="plan" class="detail-list">
              <li v-for="r in planRows" :key="r.fileId" :class="{ failed: !r.ok }">
                <strong>{{ r.videoCode || baseName(r.path) || '—' }}</strong>
                <em class="kind">{{ r.ok ? modeName : '跳过' }}</em>
                <span class="why">{{ r.ok ? baseName(r.target) : r.reason }}</span>
                <span class="sz">{{ gb(r.size) }}</span>
              </li>
            </ul>

            <p v-if="!plan" class="hint">
              预检只读目录和文件是否存在，一个字节都不动。<strong>移动</strong>会把库里那份的路径改口到目标盘：
              目标盘拔掉之后这些片子会变死链（每日盘上核对会报出来）。想先验货再决定就用<strong>复制</strong>。
              同名文件一律不覆盖，会跳出来让你先处理。
            </p>
          </template>
        </div>

        <div class="dialog__foot">
          <button v-if="relRunning" class="btn btn--danger" @click="stopRelocate">停止搬移</button>
          <button v-else class="btn" :disabled="checking" @click="precheck">
            {{ checking ? '预检中…' : (plan ? '重新预检' : '预检') }}
          </button>
          <button class="btn" @click="showRelocate = false">关闭</button>
          <button
            v-if="!relRunning && plan && plan.okCount"
            class="btn btn--primary"
            :disabled="starting"
            @click="runRelocate"
          >
            {{ starting ? '启动中…' : `执行${modeName}（${plan.okCount} 个 · ${gb(plan.totalSize)}）` }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { videoApi } from '@/scripts/api'
import { useUiStore, errText } from '@/scripts/store/ui'
import { formatDuration, formatEta, codecLabel } from '@/scripts/utils/format'
import { copyText } from '@/scripts/utils/clipboard'
import { loadFilterState, saveFilterState } from '@/scripts/utils/filterPersist'
import { CODEC_OPTIONS } from '@/scripts/constants'
import SelectList from '@/views/components/SelectList.vue'
import Pagination from '@/views/components/Pagination.vue'
import JobBar from '@/views/components/JobBar.vue'

const ui = useUiStore()

const SCOPE_OPTIONS = [
  { value: 'default', label: '影片口径那一版' },
  { value: 'all', label: '每一份文件' }
]
const BAND_LABELS = { 'a<1': '低于 1', 'b1-1.5': '1 ~ 1.5', 'c1.5-2.5': '1.5 ~ 2.5', 'd2.5-4': '2.5 ~ 4', 'e4-8': '4 ~ 8', 'f>8': '8 以上' }
const bandLabel = (b) => BAND_LABELS[b] || b

const d = ref(null)
// 内容重复（指纹分组）：判据与码率分析无关，所以不参与上面那套筛选条件
const dupes = ref(null)
const loading = ref(false)
const error = ref('')
const page = ref(1)
const pageSize = ref(50)
const selected = ref([])
const form = ref({ targetMbps: 2.5, minSizeGb: 1, scope: 'default', codec: '', skipLiked: false })

// 体积一律用十进制 GB：和系统显示磁盘容量的口径对齐，才看得出"腾得出多少地方"
const gb = (bytes) => (bytes ? (bytes / 1e9).toFixed(1) + ' GB' : '0 GB')

const allChecked = computed(() => d.value?.items?.length > 0 && selected.value.length === d.value.items.length)

const toggleAll = () => {
  selected.value = allChecked.value ? [] : (d.value?.items || []).map((r) => r.fileId)
}

const load = async () => {
  loading.value = true
  error.value = ''
  try {
    const params = { ...form.value, page: page.value, pageSize: pageSize.value }
    // 指纹那份是另一条判据，跟码率一起刷，免得"重新计算"只算一半
    const [res, dup] = await Promise.all([videoApi.optimize(params), videoApi.getDuplicates()])
    dupes.value = dup?.success ? dup.data : null
    if (!res.success) {
      error.value = res.message || '分析失败'
      return
    }
    d.value = res.data
    // 翻页后上一轮的勾选就不在这页里了，留着只会让人以为还选中着
    const alive = new Set(res.data.items.map((r) => r.fileId))
    selected.value = selected.value.filter((id) => alive.has(id))
  } catch (err) {
    error.value = '分析失败：' + errText(err)
  } finally {
    loading.value = false
  }
}

const byIds = (ids) => (d.value?.items || []).filter((r) => ids.includes(r.fileId))

const report = async (ok, n) => {
  ui[ok ? 'success' : 'error'](ok ? `已复制 ${n} 行到剪贴板` : '复制失败：这个浏览器环境下读不到剪贴板')
}

const copyPaths = async (rows) => {
  const list = rows.map((r) => r.path).filter(Boolean)
  if (!list.length) return ui.warn('这些行还没有文件路径')
  await report(await copyText(list.join('\n')), list.length)
}

const copyCsv = async () => {
  const rows = byIds(selected.value)
  if (!rows.length) return
  const head = '番号,行番号,片名,编码,宽,高,秒,字节,码率Mbps,目标Mbps,可省字节,路径'
  const body = rows.map((r) => [
    r.videoCode, r.fileCode, r.videoName, r.codec, r.resW, r.resH, r.duration,
    r.size, r.mbps.toFixed(3), d.value.targetMbps, r.saveable, r.path
  ].map(csvCell).join(','))
  await report(await copyText([head, ...body].join('\n')), rows.length)
}

/** 片名里逗号、引号都有，CSV 必须按规范转义，否则粘进表格会错列 */
const csvCell = (v) => {
  const s = String(v ?? '')
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

// ------------------------------------------------------------ 把选中的文件搬到别的目录
//
// 三条设计上的坚持（和后端 FileRelocateJob 对齐）：
//   · 一定要先预检：不可逆的批量文件动作，得先看清"要动哪几个、哪几个不能动、为什么"；
//   · 预检和执行发的是同一份参数（整个勾选列表，不是"可动的那几个"），
//     由后端一遍判定，保证界面上看到的清单和真正发生的动作不是两回事；
//   · 进度挂在后端任务上，这里只每 2 秒看一眼：跨卷搬几个 GB 是小时级的活，
//     关窗口、换页面都不该把它带走，反过来页面中途打开也得能接上正在跑的那一批。

// 目标目录要记住 —— 这是"拷去哪台设备"的固定答案，每次重打一遍没道理。
// 用列表页那一层的持久化（整块一份），不为它新造一套键名规则
const MEMO_KEY = 'optimize-relocate'
const memo = loadFilterState(MEMO_KEY) || {}
const dest = ref(memo.dest || '')
const mode = ref(memo.mode === 'copy' ? 'copy' : 'move')
const modeName = computed(() => (mode.value === 'copy' ? '复制' : '移动'))

const showRelocate = ref(false)
const plan = ref(null)
const checking = ref(false)
const starting = ref(false)
const relJob = ref(null)
let relTimer = null
let relWatching = false

const relRunning = computed(() => !!relJob.value?.running)
const baseName = (p) => (p || '').split('/').pop() || ''

/** 动不了的排在前面：那几行才是要人先去处理的 */
const planRows = computed(() =>
  [...(plan.value?.rows || [])].sort((a, b) => (a.ok === b.ok ? b.size - a.size : a.ok ? 1 : -1))
)

// 预检结论只对"这一批 + 这一个目标 + 这一个模式"成立，三样任一变了就作废，逼人重新看一眼
watch([dest, mode, selected], () => { plan.value = null })
watch([dest, mode], () => saveFilterState(MEMO_KEY, { dest: dest.value, mode: mode.value }))

const relText = computed(() => {
  const s = relJob.value
  if (!s) return ''
  const bad = s.failed ? ` · 没搬成 ${s.failed} 个` : ''
  const cur = s.current ? ` · 正在 ${s.current}` : ''
  const tail = s.etaSeconds ? ` · ${formatEta(s.etaSeconds)}` : ''
  return `${s.what} · 已搬 ${s.processed}/${s.total} · ${gb(s.bytes)}${bad}${cur}${tail}`
})

const stopRelocatePoll = () => {
  if (relTimer) {
    clearInterval(relTimer)
    relTimer = null
  }
}

const ensureRelocatePolling = () => {
  if (!relTimer) relTimer = setInterval(pollRelocate, 2000)
}

const pollRelocate = async () => {
  let res
  try {
    res = await videoApi.relocateStatus()
  } catch {
    return // 轮询失败下一轮再来，不值得弹错误
  }
  if (!res.success) return

  if (res.data.running) {
    relJob.value = res.data
    relWatching = true
    ensureRelocatePolling()
    return
  }

  relJob.value = null
  if (!relWatching) return
  relWatching = false
  stopRelocatePoll()

  const last = res.data.lastRun
  const verb = last?.mode === 'copy' ? '复制' : '搬移'
  ui[last?.failed || last?.cancelled ? 'warn' : 'success'](
    `${verb}结束：${last?.done ?? 0} / ${last?.total ?? 0} 个 · ${gb(last?.bytes || 0)}` +
    (last?.failed ? ` · 失败 ${last.failed} 个` : '') + (last?.note ? ` · ${last.note}` : '')
  )
  // 移动会把 file_path 改掉，这一屏的路径列和"可省"都得按新状态重取
  if (last?.mode === 'move') load()
}

const openRelocate = () => { showRelocate.value = true }

const precheck = async () => {
  if (!selected.value.length) return ui.warn('先在下面勾要搬的文件')
  if (!dest.value.trim()) return ui.warn('要先给一个目标目录')
  checking.value = true
  try {
    const res = await videoApi.relocatePlan({ fileIds: selected.value, dest: dest.value.trim(), mode: mode.value })
    plan.value = res.data || null
    if (!plan.value) ui.error(res.message || '预检失败')
    else if (!res.data.okCount) ui.warn('这些一个都动不了，原因列在清单里')
  } catch (err) {
    ui.error('预检失败：' + errText(err))
  } finally {
    checking.value = false
  }
}

const runRelocate = async () => {
  starting.value = true
  try {
    const res = await videoApi.relocateRun({ fileIds: selected.value, dest: dest.value.trim(), mode: mode.value })
    if (!res.success) return ui.error(res.message || '没能启动')
    ui.info(res.message)
    plan.value = null
    relWatching = true
    relJob.value = res.data
    ensureRelocatePolling()
  } catch (err) {
    ui.error('启动失败：' + errText(err))
  } finally {
    starting.value = false
  }
}

const stopRelocate = async () => {
  try {
    const res = await videoApi.relocateStop()
    ui.info(res.message || '已请求停止')
  } catch (err) {
    ui.error('停止失败：' + errText(err))
  }
}

onMounted(() => {
  load()
  // 面板挂着就一直看着：这一批可能是从另一个标签页、另一台设备启的，
  // 只在打开那一刻看一眼接不上这种（进度条会永远不出来）。一次 status 只读几个内存计数，
  // 2 秒一次不贵，而且和跑起来之后用的是同一个定时器
  ensureRelocatePolling()
  pollRelocate()
})
onBeforeUnmount(() => {
  stopRelocatePoll()
  // 只摘轮询：任务在后端，不该被页面卸载带走
})
</script>

<style scoped>
.optimize {
  display: flex;
  flex-direction: column;
  gap: var(--s3);
}

.filters {
  display: flex;
  flex-wrap: wrap;
  align-items: end;
  gap: var(--s3);
}

.filters label {
  display: flex;
  flex-direction: column;
  gap: var(--s1);
  font-size: var(--f-sm);
  color: var(--text-dim);
}

.filters .input {
  width: 9rem;
}

.chk {
  flex-direction: row;
  align-items: center;
  gap: var(--s2);
}

.chk--box {
  height: var(--ctl-h);
}

.cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
  gap: var(--s3);
}

.card {
  padding: var(--s3);
  border: 1px solid var(--border);
  border-radius: var(--r2);
  background: var(--bg-elev);
}

.card__v {
  font-size: var(--f-xl);
  font-variant-numeric: tabular-nums;
}

.card__l {
  margin-top: var(--s1);
  font-size: var(--f-xs);
  color: var(--text-faint);
}

.card--hi {
  border-color: var(--accent);
}

.card--warn .card__v {
  color: var(--warn);
}

.breakdown {
  display: grid;
  /* min(100%, 20rem) 而不是 20rem：窄屏下固定下限会反过来把面板顶宽（实测 390px 时溢出 11px），
     表格本身已经包在 .table-wrap 里会自己横向滚 */
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 20rem), 1fr));
  gap: var(--s4);
}

.cap {
  caption-side: top;
  text-align: left;
  font-size: var(--f-xs);
  color: var(--text-faint);
  padding-bottom: var(--s1);
}

.ops {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--s2);
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

.ellip {
  max-width: 24rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.is-high {
  color: var(--warn);
}

.strong {
  font-weight: 600;
}

.tag--xs {
  padding: 0 var(--s1);
  font-size: var(--f-xs);
}

.hint {
  margin: 0;
  font-size: var(--f-xs);
  color: var(--text-faint);
  line-height: 1.6;
}

.dim { color: var(--text-dim); }
.small { font-size: var(--f-xs); }

/* ---------------- 内容重复（指纹分组） ---------------- */

.dupes {
  display: flex;
  flex-direction: column;
  gap: var(--s2);
  padding-top: var(--s3);
  border-top: 1px solid var(--border);
}

.dupes__head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--s2);
}

.dupe-group {
  display: flex;
  flex-direction: column;
  gap: var(--s1);
  padding: var(--s2);
  border: 1px solid var(--border);
  border-radius: var(--r2);
}

.dupe-file {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--s2);
  font-size: var(--f-sm);
}

/* 路径最长，只有它可以截断；番号与片名要完整看得见 */
.dupe-path {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

/* ---------------- 搬移对话框 ---------------- */

.fld {
  display: flex;
  flex-direction: column;
  gap: var(--s1);
  font-size: var(--f-sm);
  color: var(--text-dim);
}

/* 路径这种东西，中间省略比尾部裁切好用：看得出头在哪、在哪个卷下 */
.fld .input {
  width: 100%;
  text-overflow: ellipsis;
}

.mode {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s4);
}

.summary {
  margin: 0;
  font-size: var(--f-sm);
  color: var(--text-dim);
}

.summary strong {
  color: var(--accent);
  font-variant-numeric: tabular-nums;
}

.detail-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--s1);
  max-height: 42vh;
  overflow-y: auto;
  font-size: var(--f-sm);
}

.detail-list li {
  display: flex;
  align-items: baseline;
  gap: var(--s2);
  padding: 5px 8px;
  border-radius: var(--r1);
  background: var(--bg-elev-2);
  color: var(--text-dim);
}

.detail-list strong {
  color: var(--accent);
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
}

.detail-list .kind {
  font-style: normal;
  color: var(--text-faint);
  flex-shrink: 0;
}

.detail-list .why {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.detail-list .sz {
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
  color: var(--text-faint);
}

.detail-list li.failed {
  background: var(--danger-soft);
}

.detail-list li.failed strong {
  color: var(--danger);
}
</style>
