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
      是下面那项后台按节奏自己跑的体检，频率就在那儿设。
    </p>

    <!-- 备份单独一块：它读的是目录而不是库，出问题的原因也完全不同（盘没挂上、目录没配）。
         界面上能做四件事：马上存一份、改目录、把已有快照搬过去、按某一份恢复或删掉它 -->
    <div v-if="backups" class="sys-status__backups">
      <div class="bk__row">
        <span class="tag" :class="backups.configured && backups.latest ? 'tag--success' : 'tag--danger'">
          {{ backupText }}
        </span>
        <span v-if="backups.latest" class="meta">
          {{ backups.count }} 份 · 共 {{ sizeText(backups.totalBytes) }} ·
          每日留 {{ backups.keepDailyDays }} 天，更早只留周日份到 {{ backups.keepWeeklyDays }} 天，带标签的不自动删
        </span>
        <button class="btn btn--sm btn--ghost bk__right" :disabled="busy" @click="doBackupNow">
          马上备份一份
        </button>
      </div>

      <div class="bk__row">
        <input
          v-model="dirInput"
          class="input grow"
          type="text"
          spellcheck="false"
          :placeholder="backups.backupDir || '还没配快照目录'"
          aria-label="快照目录"
          @focus="dirDirty = true"
        >
        <button class="btn btn--sm" :disabled="busy || !dirChanged" @click="doSetDir">只改目录</button>
        <button class="btn btn--sm" :disabled="busy || !dirChanged" @click="doTransfer(true)">把已有快照搬过去</button>
        <button v-if="backups.fromSettings" class="btn btn--sm btn--ghost" :disabled="busy" @click="doResetDir">
          退回默认目录
        </button>
      </div>
      <p class="sys-status__note">{{ dirHint }}</p>

      <ul v-if="backups.items.length" class="backup-list">
        <li v-for="b in backups.items.slice(0, 8)" :key="b.name">
          <span class="meta">{{ b.mtime }}</span>
          <span class="bk__size">{{ sizeText(b.bytes) }}</span>
          <span class="dim bk__name" :title="b.name">{{ b.name }}</span>
          <span v-if="b.kind !== 'daily'" class="tag tag--muted">{{ b.kind }}</span>
          <button class="btn btn--sm btn--ghost" :disabled="busy" @click="doRestore(b)">恢复</button>
          <button class="btn btn--sm btn--danger" :disabled="busy" @click="doDelete(b)">删</button>
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

    <!-- 后台那轮体检：开关与频率就在这儿设（写进 system_settings，下一个看门周期生效，不用重启），
         下面两行是它上一轮跑出来的结果 -->
    <div v-if="health?.scan" class="sys-status__scan">
      <div class="scan-ctl">
        <label class="scan-ctl__switch">
          <input v-model="policy.enabled" type="checkbox" :disabled="saving" @change="savePolicy" />
          后台自动体检
        </label>
        <select
          v-model="policy.intervalDays"
          class="input scan-ctl__days"
          aria-label="体检频率"
          :disabled="saving"
          @change="savePolicy"
        >
          <option v-for="d in DAY_STEPS" :key="d" :value="d">{{ dayText(d) }}</option>
        </select>
        <button class="btn btn--sm btn--ghost" :disabled="running" @click="runNow">
          {{ running ? '正在跑…' : '立刻跑一次' }}
        </button>
      </div>
      <p class="sys-status__note">{{ policyText }}</p>

      <span class="tag" :class="scanClass">{{ scanText }}</span>
      <span class="tag" :class="sweepClass">{{ sweepText }}</span>
      <ul v-if="missingFiles.length" class="missing-list">
        <li v-for="m in missingFiles" :key="m.fileId">
          <router-link :to="`/video/${m.videoId}`" class="dim">{{ m.code || '（无番号）' }}</router-link>
          <span class="dim missing-path" :title="m.path">{{ m.path }}</span>
        </li>
      </ul>
      <p v-if="schedule?.note" class="sys-status__note">{{ schedule.note }}</p>
      <p class="sys-status__note">
        一轮体检 = 把库里登记的文件路径都 stat 一遍，再把没量过分辨率的新片补上。
        核对只报证据，不会因此改库：多个版本行指向同一个文件时按路径只数一次，
        卷掉了的时候全部文件都会报"不在"，那时候清记录就是把一次故障变成永久损坏——
        真要删，看着上面这几条自己定。关掉自动体检不影响列表页那个「扫描片源」按钮。
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
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { settingApi, systemApi, videoApi } from '@/scripts/api'
import { useUiStore, errText } from '@/scripts/store/ui'

const ui = useUiStore()

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
    syncPolicy()
    // 人正在输入的那一格不覆盖：每个动作之后都会重新拉一次概况，别把他刚粘进去的半截路径抹掉
    if (!dirDirty.value) dirInput.value = backups.value?.backupDir || ''
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

// 体检（盘上核对 + 增量扫描）的开关、频率和结果都在 health.scan.schedule 里：
// 它们不是 SQL 不变量（要么得逐条 stat，要么本来就是内存里的任务状态），所以跟自检分开摆
const scan = computed(() => health.value?.scan || null)
const schedule = computed(() => scan.value?.schedule || null)
const lastRun = computed(() => scan.value?.lastRun || null)
const sweep = computed(() => schedule.value?.sweep || null)

// 频率只给这几个档：1 是"每天"，3/7 是他要的"隔几天"，30 是"每月看一眼"的上限
const DAY_STEPS = [1, 2, 3, 7, 14, 30]
const dayText = (d) => (d === 1 ? '每天一轮' : `每 ${d} 天一轮`)

// 这两个值以库里的为准，界面只是把后端读回来的填进控件；
// saving 期间不同步，否则刚勾上就被上一趟请求的结果打回去
const policy = ref({ enabled: true, intervalDays: 1 })
const saving = ref(false)
const runningNow = ref(false)
const running = computed(() => !!schedule.value?.running || runningNow.value)

const syncPolicy = () => {
  const s = schedule.value
  if (!s || saving.value) return
  policy.value = { enabled: !!s.enabled, intervalDays: DAY_STEPS.includes(s.intervalDays) ? s.intervalDays : 1 }
}

const policyText = computed(() => {
  const s = schedule.value
  if (!s) return ''
  if (!s.enabled) return '关着：后台不会自己跑，只有点「立刻跑一次」或列表页的「扫描片源」时才动'
  const last = s.lastRun ? `上次 ${s.lastRun}` : '还没跑过'
  const next = s.nextRunAt ? `，下次约 ${s.nextRunAt}` : ''
  const wait = s.due ? `（已到点，最多再等 ${s.watchdogMinutes} 分钟）` : ''
  return `${dayText(s.intervalDays)} · ${last}${next}${wait}`
})

const savePolicy = async () => {
  saving.value = true
  try {
    const res = await Promise.all([
      settingApi.save({ name: 'scan_auto_enabled', content: policy.value.enabled ? '1' : '0' }),
      settingApi.save({ name: 'scan_interval_days', content: String(policy.value.intervalDays) })
    ])
    const bad = res.find((r) => !r?.success)
    if (bad) {
      ui.error(bad.message || '保存失败')
      await load()   // 没写进去就把控件拨回去
      return
    }
    ui.success(policy.value.enabled
      ? `${dayText(policy.value.intervalDays)}（下一个看门周期生效，不用重启）`
      : '后台自动体检已关掉')
    await load()
  } catch (err) {
    console.error('保存体检节奏失败:', err)
    ui.error('保存失败：' + errText(err))
    await load()
  } finally {
    saving.value = false
  }
}

// 轮询只在手动触发时挂：跑完就自己摘掉
let pollTimer = null
const stopPoll = () => {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}
onBeforeUnmount(stopPoll)

// 到点没到点都不等：手动这一轮同样会刷新"上次/下次"，因为跑一轮就把开始时间落库
const runNow = async () => {
  try {
    const res = await systemApi.runScanNow()
    if (!res?.success) {
      ui.warn(res?.message || '没能启动')
      return
    }
    ui.info(res.message)
    runningNow.value = true
    if (!pollTimer) pollTimer = setInterval(pollRun, 3000)
  } catch (err) {
    console.error('触发体检失败:', err)
    ui.error('失败：' + errText(err))
  }
}

// 只重读 health 这一个接口：跑完再整块刷新一次，免得每三秒发四条请求
const pollRun = async () => {
  let res
  try { res = await systemApi.health() } catch { return }
  if (!res?.success) return
  health.value = res.data
  if (res.data?.scan?.schedule?.running) return
  stopPoll()
  runningNow.value = false
  await load()
}

const scanText = computed(() => {
  if (running.value) return '这一轮正在跑'
  const r = lastRun.value
  if (!r) return '这个进程还没跑过扫描'
  return `${r.trigger}扫描 ${r.finishedAt}：查 ${r.processed} 个 · 量到 ${r.ok} 个`
    + (r.missed ? ` · 读不出 ${r.missed} 个` : '')
    + (r.note ? ` · ${r.note}` : '')
})

// 读不出≠出问题：新片还没下完也会读不出。只有"盘上没有"那种才值得多看一眼
const scanClass = computed(() => {
  if (running.value) return 'tag--muted'
  const r = lastRun.value
  if (!r) return 'tag--muted'
  return r.missing > 0 ? 'tag--warn' : 'tag--success'
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

// 快照目录与四个动作。目录是"以后往哪儿写"，搬文件是另一件事，所以界面上分成两个按钮
const busy = ref(false)
const dirInput = ref('')
const dirDirty = ref(false)
const dirChanged = computed(() => dirDirty.value
  && dirInput.value.trim() !== (backups.value?.backupDir || '').trim())

// 口令那三道（搬、恢复、删）没设口令时是直接放行的，所以这里不再额外提示"要先设口令"，
// 只在服务端真回了 401 时把它的原话显示出来
const dirHint = computed(() => {
  const b = backups.value
  if (!b) return ''
  const from = b.fromSettings ? '界面设的那份' : '配置文件里那份（改这里会存进设置）'
  return `现在往 ${b.backupDir || '(没配)'} 写，来源：${from}。`
    + '搬目录只动本程序命名的 ckplayer_*.db，旁边别的项目的文件不碰；先复制、对完字节数才删源。'
})

const applyBackupPayload = (data) => {
  if (data?.backups) backups.value = data.backups
  dirDirty.value = false
  dirInput.value = backups.value?.backupDir || ''
}

const doBackupNow = async () => {
  busy.value = true
  try {
    const res = await systemApi.backupNow()
    applyBackupPayload(res?.data)
    ui[res?.data?.created ? 'success' : 'info'](res?.message || '没动静')
    await load()
  } catch (err) {
    ui.error('备份失败：' + errText(err))
  } finally { busy.value = false }
}

const doSetDir = async () => {
  busy.value = true
  try {
    const res = await systemApi.setBackupDir(dirInput.value.trim())
    if (!res?.success) { ui.error(res?.message || '没能改'); return }
    applyBackupPayload(res.data)
    ui.success(res.message)
    await load()
  } catch (err) {
    ui.error('改目录失败：' + errText(err))
  } finally { busy.value = false }
}

const doResetDir = async () => {
  busy.value = true
  try {
    const res = await systemApi.setBackupDir('')
    applyBackupPayload(res?.data)
    ui[res?.success ? 'success' : 'error'](res?.message || '已退回')
    await load()
  } catch (err) {
    ui.error('退回失败：' + errText(err))
  } finally { busy.value = false }
}

const doTransfer = async (removeSource) => {
  const to = dirInput.value.trim()
  const go = await ui.confirm({
    title: removeSource ? '确认把快照搬过去' : '确认复制快照过去',
    message: `要把当前目录里本程序的快照${removeSource ? '搬' : '复制'}到 ${to}；`
      + (removeSource ? '复制完会逐份对字节数，对上了才删源。' : '原处那份留着不动。')
      + '同一目录里别的项目的文件一律不碰。',
    confirmLabel: removeSource ? '搬过去' : '复制过去',
    danger: removeSource
  })
  if (!go) return
  busy.value = true
  try {
    const res = await systemApi.transferBackupDir(to, removeSource)
    if (!res?.success) { ui.error(res?.message || '搬失败了'); return }
    applyBackupPayload(res.data)
    ui.success(res.message)
    await load()
  } catch (err) {
    ui.error('搬目录失败：' + errText(err))
  } finally { busy.value = false }
}

const doRestore = async (b) => {
  const go = await ui.confirm({
    title: '确认恢复到这份快照',
    message: `按 ${b.name} 恢复之后，这份快照之后写进去的一切都会没有：新录的片、点赞、播放进度、`
      + '改过的字幕/水印标记。恢复前会先给当前库存一份 pre-restore 凭证，反悔了能灌回去。'
      + (b.kind !== 'daily' ? `这一份是「${b.kind}」，通常比当天最后一版更旧，想清楚是不是它。` : ''),
    confirmLabel: '按这份恢复',
    danger: true
  })
  if (!go) return
  busy.value = true
  try {
    const res = await systemApi.restore(b.name)
    applyBackupPayload(res?.data)
    const r = res?.data?.restore
    const f = res?.data?.final
    if (!res?.success) { ui.error(res?.message || '恢复失败'); await load(); return }
    ui.success(r && f
      ? `已按 ${r.snapshot} 恢复：影片 ${r.videosBefore}→${f.videos}、版本 ${r.filesBefore}→${f.files}、`
        + `点赞 ${r.likesBefore}→${f.likes}。恢复前的库存在 ${r.preRestoreFile}`
        + (r.snapshotHasFiles ? '' : '（那份还没有版本表，是恢复时补结构建出来的）')
      : res.message)
    await load()
  } catch (err) {
    ui.error('恢复失败：' + errText(err))
  } finally { busy.value = false }
}

const doDelete = async (b) => {
  const go = await ui.confirm({
    title: '确认删掉这份快照',
    message: `${b.name}（${sizeText(b.bytes)}）会从磁盘上删掉，删了就没有回滚点了。`
      + (b.kind !== 'daily' ? `它还是「${b.kind}」那次动作之前的唯一凭证。` : ''),
    confirmLabel: '删掉文件',
    danger: true
  })
  if (!go) return
  busy.value = true
  try {
    const res = await systemApi.deleteBackup(b.name)
    applyBackupPayload(res?.data)
    ui[res?.success ? 'success' : 'error'](res?.message || '操作失败')
    await load()
  } catch (err) {
    ui.error('删失败：' + errText(err))
  } finally { busy.value = false }
}

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

/* 开关那一行：复选框、频率、按钮同一行排开，窄屏自然折行 */
.scan-ctl {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--s2);
}

.scan-ctl__switch {
  display: inline-flex;
  align-items: center;
  gap: var(--s1);
  font-size: var(--f-sm);
}

/* 频率只有六个档位，给个窄宽度别让它抢走整行 */
.scan-ctl__days {
  flex: 0 1 auto;
  width: auto;
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

/* 快照这块的两行操作条：一行状态 + 一行目录，按钮靠 gap 排，不各自算 margin */
.bk__row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--s2);
}

.bk__right {
  margin-left: auto;
}

/* 体积那一列宽度固定，几行看下来能竖着比大小 */
.bk__size {
  min-width: 5.5em;
}

/* 文件名可以截断，按钮与标签不行 */
.backup-list .btn,
.backup-list .tag {
  flex: none;
}
</style>
