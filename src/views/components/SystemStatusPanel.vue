<template>
  <div class="sys-status">
    <div class="sys-status__bar">
      <!-- 一句话说清整体状态，免得人要逐行看 -->
      <span class="tag" :class="stateClass">{{ stateText }}</span>
      <span v-if="data" class="meta">
        schema {{ data.schemaVersion }}<template v-if="data.schemaVersion !== data.targetVersion">（代码期望 {{ data.targetVersion }}，迁移没跑完）</template>
        · {{ (data.journalMode || '').toUpperCase() }}
        · {{ data.totals.videos }} 部 / {{ data.totals.files }} 版
        · {{ data.ranAt }}
      </span>
      <button class="btn btn--sm btn--ghost" :disabled="loading" @click="load">
        {{ loading ? '体检中…' : '重新体检' }}
      </button>
    </div>

    <p v-if="error" class="notice notice--error">{{ error }}</p>

    <table v-if="data" class="grid-table">
      <thead>
        <tr>
          <th>检查项</th>
          <th class="num">计数</th>
          <th>说明</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="c in data.checks" :key="c.key" :class="{ 'is-bad': !c.pass }">
          <td>
            <span class="mark" :aria-label="c.pass ? '通过' : '违例'">{{ c.pass ? '✓' : '!' }}</span>
            {{ c.label }}
          </td>
          <td class="num" :class="{ 'is-warn': c.count > 0 }">{{ c.count < 0 ? '—' : c.count }}</td>
          <td class="dim">
            <!-- 违例时样本比措辞有用，所以样本放最前，hint 跟在后面 -->
            <template v-if="c.samples">{{ c.samples }}</template>
            <template v-else-if="c.hint">{{ c.hint }}</template>
            <template v-else>—</template>
          </td>
        </tr>
      </tbody>
    </table>

    <p class="sys-status__foot">
      上面的检查只跑纯 SQL（几十毫秒）。要看"文件是不是真的还在盘上"那种得逐条 stat 挂载卷的，
      是每天后台自己跑一次的那一项，结果在下面。
    </p>

    <!-- 备份单独一块：它读的是目录而不是库，出问题的原因也完全不同（盘没挂上、目录没配） -->
    <div v-if="backups" class="sys-status__backups">
      <span class="tag" :class="backups.configured && backups.latest ? 'tag--success' : 'tag--danger'">
        {{ backupText }}
      </span>
      <span v-if="backups.latest" class="meta">
        {{ backups.count }} 份 · 每日留 {{ backups.keepDailyDays }} 天，更早只留周日份到 {{ backups.keepWeeklyDays }} 天
      </span>
      <ul v-if="backups.configured" class="backup-list">
        <li v-for="b in backups.items.slice(0, 6)" :key="b.name">
          <span class="meta">{{ b.mtime }}</span>
          <span>{{ sizeText(b.bytes) }}</span>
          <span class="dim">{{ b.name }}</span>
          <span v-if="b.kind !== 'daily'" class="tag tag--muted">{{ b.kind }}</span>
        </li>
      </ul>
    </div>

    <!-- 卷没挂上时的表现是"封面全空、扫描说没文件"，而服务本身看着完全健康，
         所以这里把配置里那几个目录在不在直接列出来 -->
    <!-- 疑似重复只在真有结果或还没扫过时出现，避免空面板多一块"什么都没有" -->
    <div v-if="dupes && (dupes.groupCount || dupes.fingerprinted)" class="sys-status__dupes">
      <span class="tag" :class="dupes.groupCount ? 'tag--warn' : 'tag--success'">
        {{ dupes.groupCount ? `疑似重复 ${dupes.groupCount} 组` : '没有发现内容相同的文件' }}
      </span>
      <span class="meta">已算指纹 {{ dupes.fingerprinted }} / {{ dupes.filesWithContent }} 个文件{{ dupes.fingerprinted < dupes.filesWithContent ? '（没扫到的那部分不参与判断）' : '' }}</span>
      <div v-for="g in dupes.groups.slice(0, 8)" :key="g.fingerprint" class="dupe-group">
        <span class="meta">指纹 {{ g.fingerprint.slice(0, 18) }}…</span>
        <div v-for="f in g.files" :key="f.fileId" class="dupe-file">
          <router-link :to="`/video/${f.videoId}`" class="dim">{{ f.videoCode }}</router-link>
          <span>{{ f.videoName }}</span>
          <span class="meta">{{ sizeText(f.size) }}</span>
          <span class="dim dupe-path" :title="f.path">{{ f.path }}</span>
        </div>
      </div>
      <p class="sys-status__note">这里只列证据：留哪一条、要不要删，得人来定。</p>
    </div>

    <!-- 扫描与盘上核对：每天自己跑的那两件事得有个地方说结果，
         否则"新片的分辨率一直没补上""文件早被搬走了"都只能靠人自己想起来去点按钮 -->
    <div v-if="health?.scan" class="sys-status__scan">
      <span class="tag" :class="scanClass">{{ scanText }}</span>
      <span class="meta">{{ scanMeta }}</span>

      <span class="tag" :class="sweepClass">{{ sweepText }}</span>
      <ul v-if="missingFiles.length" class="missing-list">
        <li v-for="m in missingFiles" :key="m.fileId">
          <router-link :to="`/video/${m.videoId}`" class="dim">{{ m.code || '（无番号）' }}</router-link>
          <span class="dim missing-path" :title="m.path">{{ m.path }}</span>
        </li>
      </ul>
      <p class="sys-status__note">
        核对只 stat 文件在不在，不读内容，也不会因此改库：多个版本行指向同一个文件时按路径只数一次。
        卷掉了的时候全部文件都会报"不在"，那时候清记录就是把一次故障变成永久损坏——
        真要删，看着上面这几条自己定。
      </p>
    </div>

    <div v-if="health" class="sys-status__vols">
      <span class="tag" :class="health.ok ? 'tag--success' : 'tag--danger'">{{ health.ok ? '存储与目录都正常' : health.problems.join('；') }}</span>
      <span class="meta">库可写 {{ health.dbWritable ? '是' : '否' }} · 缩略图缓存可写 {{ health.thumbsWritable ? '是' : '否' }} · {{ health.checkedAt }}</span>
      <ul class="vol-list">
        <li v-for="vol in health.volumes" :key="vol.path" :class="{ 'is-bad': !vol.present }">
          <span class="mark" :aria-label="vol.present ? '在' : '不在'">{{ vol.present ? '✓' : '!' }}</span>
          <span>{{ vol.purpose }}</span>
          <span class="dim">{{ vol.path }}</span>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { systemApi, videoApi } from '@/scripts/api'

const data = ref(null)
const backups = ref(null)
const health = ref(null)
const dupes = ref(null)
const loading = ref(false)
const error = ref('')

// notice 级只是"规模提醒"（还没扫的、还没标的），不算失败，别用红色吓人
const badCount = computed(() => (data.value ? data.value.failed : 0))
const noticeCount = computed(() => {
  if (!data.value) return 0
  return data.value.checks.filter((c) => c.level === 'notice' && c.count > 0).length
})
const stateText = computed(() => {
  if (loading.value && !data.value) return '体检中…'
  if (!data.value) return '还没体检'
  if (badCount.value > 0) return `${badCount.value} 项违例`
  return noticeCount.value ? `不变量全通过（${noticeCount.value} 项待办提醒）` : '不变量全通过'
})
const stateClass = computed(() => {
  if (!data.value) return 'tag--muted'
  if (badCount.value > 0) return 'tag--danger'
  return 'tag--success'
})

const load = async () => {
  loading.value = true
  error.value = ''
  try {
    const [c, b, h, d] = await Promise.all([
      systemApi.checks(), systemApi.backups(), systemApi.health(), videoApi.getDuplicates()
    ])
    if (!c?.success) {
      error.value = c?.message || '体检失败'
      return
    }
    data.value = c.data
    backups.value = b?.success ? b.data : null
    health.value = h?.success ? h.data : null
    dupes.value = d?.success ? d.data : null
  } catch (err) {
    console.error('系统自检失败:', err)
    error.value = '体检失败：请确认后端服务可用'
  } finally {
    loading.value = false
  }
}

// 备份超龄也要在这里说出来：进程连着跑好几天时快照是靠服务每小时自查的，
// 真出问题的表现恰恰是"人没注意"，所以宁可在面板上明说
const backupText = computed(() => {
  if (!backups.value) return '备份状态未知'
  if (!backups.value.configured) return '没配置备份目录'
  if (!backups.value.latest) return '还没有任何快照'
  const day = backups.value.latest.mtime.slice(0, 10)
  const today = new Date(); const pad = (n) => String(n).padStart(2, '0')
  const now = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`
  return day === now ? `今日快照已就位（${day}）` : `最近快照是 ${day}，今天这份还没落盘`
})

// 扫描与盘上核对的结果都在 health.scan 里：它们不是 SQL 不变量（要么得逐条 stat，
// 要么本来就是内存里的任务状态），所以跟自检分开摆
const scan = computed(() => health.value?.scan || null)
const schedule = computed(() => scan.value?.schedule || null)
const lastRun = computed(() => scan.value?.lastRun || null)
const sweep = computed(() => schedule.value?.sweep || null)

const scanText = computed(() => {
  if (schedule.value && schedule.value.enabled === false) return '自动扫描已关闭（Media:AutoScan=false）'
  if (scan.value?.running) return '扫描进行中'
  const r = lastRun.value
  if (!r) return '这个进程还没跑过扫描'
  return `${r.trigger}扫描 ${r.finishedAt}：查 ${r.processed} 个 · 量到 ${r.ok} 个`
    + (r.missed ? ` · 读不出 ${r.missed} 个` : '')
})

// 读不出≠出问题：新片还没下完也会读不出。只有"盘上没有"那种才值得多看一眼
const scanClass = computed(() => {
  if (scan.value?.running) return 'tag--muted'
  if (schedule.value && schedule.value.enabled === false) return 'tag--muted'
  const r = lastRun.value
  if (!r) return 'tag--muted'
  return r.missing > 0 ? 'tag--warn' : 'tag--success'
})

const scanMeta = computed(() => {
  const s = schedule.value
  if (!s) return ''
  const parts = []
  parts.push(s.scannedOn === s.today
    ? '今天这一轮已经跑过'
    : `今天（${s.today}）还没跑：启动 ${s.startupDelayMinutes} 分钟后开始，之后每 ${s.intervalMinutes} 分钟看一次`)
  if (s.note) parts.push(s.note)
  if (lastRun.value?.cancelled) parts.push('上一轮是手动停的，数字是停下的那一刻')
  return parts.join(' · ')
})

const sweepText = computed(() => {
  const w = sweep.value
  if (!w) return '还没做过盘上核对'
  if (w.suspicious) return `盘上核对：${w.missing} / ${w.checked} 个报"不在"，占比过高，多半是挂载卷掉了`
  // 卷冷到第一个文件都没 stat 完也会发生，这时候"0 个都在"是假的好消息
  if (w.complete === false && !w.checked) return `盘上核对：一个都没来得及看（${w.ranAt}）`
  const part = w.complete === false ? '·没看完，时间用完' : ''
  return w.missing
    ? `盘上核对：查了 ${w.checked} 个文件${part}，${w.missing} 个不在盘上（${w.ranAt}）`
    : `盘上核对：${w.checked} 个文件都在${part}（${w.ranAt}）`
})

const sweepClass = computed(() => {
  const w = sweep.value
  if (!w) return 'tag--muted'
  if (w.suspicious) return 'tag--danger'
  return w.missing || w.complete === false ? 'tag--warn' : 'tag--success'
})

// 可疑的那一轮不列清单：整卷没挂时报出来的会是"全库都不在"，那种名单只会误导人
const missingFiles = computed(() => {
  const w = sweep.value
  return w && !w.suspicious ? (w.samples || []) : []
})

const sizeText = (bytes) => (bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB`
  : `${Math.round(bytes / 1024)} KB`)

onMounted(load)
</script>

<style scoped>
.sys-status {
  display: flex;
  flex-direction: column;
  gap: var(--s3);
}

.sys-status__bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--s2);
}

/* 按钮靠右：概览文字长短不一，用 margin-auto 才不会被挤来挤去 */
.sys-status__bar .btn {
  margin-left: auto;
}

.mark {
  display: inline-flex;
  width: 1.4em;
  height: 1.4em;
  margin-right: var(--s1);
  border-radius: 50%;
  align-items: center;
  justify-content: center;
  background: var(--success-soft);
  color: var(--success);
  font-size: var(--f-xs);
  font-weight: 600;
}

tr.is-bad .mark {
  background: var(--danger-soft);
  color: var(--danger);
}

.is-warn {
  color: var(--danger);
  font-weight: 600;
}

.sys-status__foot {
  margin: 0;
  color: var(--text-dim);
  font-size: var(--f-xs);
}

.sys-status__dupes {
  display: flex;
  flex-direction: column;
  gap: var(--s2);
  padding-top: var(--s3);
  border-top: 1px solid var(--border);
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

.sys-status__note {
  margin: 0;
  color: var(--text-dim);
  font-size: var(--f-xs);
}

/* 扫描 + 盘上核对：两块都在讲"文件的事"，所以紧跟在重复清单后面 */
.sys-status__scan {
  display: flex;
  flex-direction: column;
  gap: var(--s2);
  padding-top: var(--s3);
  border-top: 1px solid var(--border);
}

/* 一条一行：番号短、路径长，只有路径可以截断（跟上面重复清单同一套排版） */
.missing-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: var(--s1);
  font-size: var(--f-sm);
}

.missing-list li {
  display: flex;
  align-items: baseline;
  gap: var(--s2);
  min-width: 0;
}

.missing-path {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.sys-status__vols {
  display: flex;
  flex-direction: column;
  gap: var(--s2);
  padding-top: var(--s3);
  border-top: 1px solid var(--border);
}

.vol-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: var(--s1);
  font-size: var(--f-sm);
}

.vol-list li {
  display: flex;
  align-items: baseline;
  gap: var(--s2);
  min-width: 0;
}

.vol-list .dim {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

/* 丢了的目录整行标红，比只在顶部徽章里提一句好定位——问题常常是某一个卷没挂 */
.vol-list li.is-bad {
  color: var(--danger);
}

.sys-status__backups {
  display: flex;
  flex-direction: column;
  gap: var(--s2);
  padding-top: var(--s3);
  border-top: 1px solid var(--border);
}

.backup-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: var(--s1);
  font-size: var(--f-sm);
}

/* 一份一行：时间 · 大小 · 文件名。文件名最长所以让它可截断，其余不换行 */
.backup-list li {
  display: flex;
  align-items: baseline;
  gap: var(--s2);
  min-width: 0;
}

.backup-list .dim {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
</style>
