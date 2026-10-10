<template>
  <div class="backup">
    <div v-if="error" class="notice notice--error">{{ error }}</div>

    <template v-else-if="backups">
      <div class="bk__row">
        <span class="tag" :class="backups.configured && backups.latest ? 'tag--success' : 'tag--danger'">
          {{ backupText }}
        </span>
        <span v-if="backups.latest" class="meta">
          {{ backups.count }} 份 · 共 {{ formatSize(backups.totalBytes) }} ·
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
      <p class="bk__note">{{ dirHint }}</p>

      <ul v-if="backups.items.length" class="backup-list">
        <li v-for="b in backups.items.slice(0, 8)" :key="b.name">
          <span class="meta">{{ b.mtime }}</span>
          <span class="bk__size">{{ formatSize(b.bytes) }}</span>
          <span class="dim bk__name" :title="b.name">{{ b.name }}</span>
          <span v-if="b.kind !== 'daily'" class="tag tag--muted">{{ b.kind }}</span>
          <button class="btn btn--sm btn--ghost" :disabled="busy" @click="doRestore(b)">恢复</button>
          <button class="btn btn--sm btn--danger" :disabled="busy" @click="doDelete(b)">删</button>
        </li>
      </ul>
      <p class="bk__note">
        列表只列最近 8 份，目录里实际有多少份看上面那句计数。
        「恢复」是拿快照灌回当前库，不是换文件，所以不用停服务；灌之前会先给当前库存一份 pre-restore 凭证。
      </p>
    </template>

    <div v-else class="rows" aria-busy="true"><div v-for="n in 3" :key="n" class="skeleton row-skeleton"></div></div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { systemApi } from '@/scripts/api'
import { useUiStore, errText } from '@/scripts/store/ui'
import { formatSize } from '@/scripts/utils/format'

const ui = useUiStore()

const backups = ref(null)
const busy = ref(false)
const error = ref('')

const dirInput = ref('')
const dirDirty = ref(false)
const dirChanged = computed(() => dirDirty.value
  && dirInput.value.trim() !== (backups.value?.backupDir || '').trim())

// 备份读的是目录不是库，出问题的原因完全不同（盘没挂上、目录没配），所以单独一个面板
const backupText = computed(() => {
  if (!backups.value) return '备份状态未知'
  if (!backups.value.configured) return '没配置备份目录'
  if (!backups.value.latest) return '还没有任何快照'
  const day = backups.value.latest.mtime.slice(0, 10)
  const today = new Date(); const pad = (n) => String(n).padStart(2, '0')
  const now = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`
  return day === now ? `今日快照已就位（${day}）` : `最近快照是 ${day}，今天这份还没落盘`
})

// 口令那三道（搬、恢复、删）没设口令时是直接放行的，所以这里不再额外提示"要先设口令"，
// 只在服务端真回了 401 时把它的原话显示出来
const dirHint = computed(() => {
  const b = backups.value
  if (!b) return ''
  const from = b.fromSettings ? '界面设的那份' : '配置文件里那份（改这里会存进设置）'
  return `现在往 ${b.backupDir || '(没配)'} 写，来源：${from}。`
    + '搬目录只动本程序命名的 ckplayer_*.db，旁边别的项目的文件不碰；先复制、对完字节数才删源。'
})

const load = async () => {
  error.value = ''
  try {
    const res = await systemApi.backups()
    if (!res?.success) {
      error.value = res?.message || '读取快照列表失败'
      return
    }
    // 这个接口给的就是那份状态本身；只有下面几个动作的返回里才把它包在 data.backups 里
    backups.value = res.data
    if (!dirDirty.value) dirInput.value = res.data?.backupDir || ''
  } catch (err) {
    console.error('读取备份状态失败:', err)
    error.value = '读取备份状态失败：' + errText(err)
  }
}

/** 每个动作的返回里都带回一份新的列表，直接用它，省一次往返 */
const applyPayload = (data) => {
  if (data?.backups) backups.value = data.backups
  dirDirty.value = false
  dirInput.value = backups.value?.backupDir || ''
}

const doBackupNow = async () => {
  busy.value = true
  try {
    const res = await systemApi.backupNow()
    applyPayload(res?.data)
    ui[res?.data?.created ? 'success' : 'info'](res?.message || '没动静')
  } catch (err) {
    ui.error('备份失败：' + errText(err))
  } finally { busy.value = false }
}

const doSetDir = async () => {
  busy.value = true
  try {
    const res = await systemApi.setBackupDir(dirInput.value.trim())
    if (!res?.success) { ui.error(res?.message || '没能改'); return }
    applyPayload(res.data)
    ui.success(res.message)
  } catch (err) {
    ui.error('改目录失败：' + errText(err))
  } finally { busy.value = false }
}

const doResetDir = async () => {
  busy.value = true
  try {
    const res = await systemApi.setBackupDir('')
    applyPayload(res?.data)
    ui[res?.success ? 'success' : 'error'](res?.message || '已退回')
  } catch (err) {
    ui.error('退回失败：' + errText(err))
  } finally { busy.value = false }
}

// 目录是"以后往哪儿写"，搬已有文件是另一件事，所以界面上分成两个按钮
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
    applyPayload(res.data)
    ui.success(res.message)
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
    applyPayload(res?.data)
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
    message: `${b.name}（${formatSize(b.bytes)}）会从磁盘上删掉，删了就没有回滚点了。`
      + (b.kind !== 'daily' ? `它还是「${b.kind}」那次动作之前的唯一凭证。` : ''),
    confirmLabel: '删掉文件',
    danger: true
  })
  if (!go) return
  busy.value = true
  try {
    const res = await systemApi.deleteBackup(b.name)
    applyPayload(res?.data)
    ui[res?.success ? 'success' : 'error'](res?.message || '操作失败')
  } catch (err) {
    ui.error('删失败：' + errText(err))
  } finally { busy.value = false }
}

onMounted(load)
</script>

<style scoped>
.backup {
  display: flex;
  flex-direction: column;
  gap: var(--s2);
}

/* 两行操作条：一行状态 + 一行目录，按钮靠 gap 排，不各自算 margin */
.bk__row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--s2);
}

.bk__right {
  margin-left: auto;
}

.bk__note {
  margin: 0;
  color: var(--text-dim);
  font-size: var(--f-xs);
  line-height: 1.6;
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

/* 体积那一列宽度固定，几行看下来能竖着比大小 */
.bk__size {
  min-width: 5.5em;
}

.backup-list .btn,
.backup-list .tag {
  flex: none;
}
</style>
