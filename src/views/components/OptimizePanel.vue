<template>
  <div class="optimize">
    <div class="panel-head">
      <div class="panel-head__text">
        <h3 class="panel-title">视频体积分析</h3>
        <p class="panel-desc">
          把「编码 + 时长 + 大小」凑在一起算平均码率，按"按目标码率重编能省下多少"排序 ——
          只看体积会挑错对象：同样 6 GB，一小时的片还有压缩空间，两小时的片多半已经压到底了。
          这里只出证据，不碰盘上任何文件。
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
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { videoApi } from '@/scripts/api'
import { useUiStore, errText } from '@/scripts/store/ui'
import { formatDuration, codecLabel } from '@/scripts/utils/format'
import { copyText } from '@/scripts/utils/clipboard'
import { CODEC_OPTIONS } from '@/scripts/constants'
import SelectList from '@/views/components/SelectList.vue'
import Pagination from '@/views/components/Pagination.vue'

const ui = useUiStore()

const SCOPE_OPTIONS = [
  { value: 'default', label: '影片口径那一版' },
  { value: 'all', label: '每一份文件' }
]
const BAND_LABELS = { 'a<1': '低于 1', 'b1-1.5': '1 ~ 1.5', 'c1.5-2.5': '1.5 ~ 2.5', 'd2.5-4': '2.5 ~ 4', 'e4-8': '4 ~ 8', 'f>8': '8 以上' }
const bandLabel = (b) => BAND_LABELS[b] || b

const d = ref(null)
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
    const res = await videoApi.optimize(params)
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

onMounted(load)
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
</style>
