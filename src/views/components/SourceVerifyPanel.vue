<template>
  <div class="verify">
    <div v-if="error" class="notice notice--error">{{ error }}</div>

    <template v-else-if="health">
      <!-- 卷没挂上时的表现是"封面全空、扫描说没文件"，而服务本身看着完全健康，
           所以把配置里那几个目录在不在直接列出来 -->
      <div class="vf__row">
        <span class="tag" :class="health.ok ? 'tag--success' : 'tag--danger'">
          {{ health.ok ? '存储与目录都正常' : health.problems.join('；') }}
        </span>
        <span class="meta">
          库可写 {{ health.dbWritable ? '是' : '否' }} · 缩略图缓存可写 {{ health.thumbsWritable ? '是' : '否' }} ·
          {{ health.checkedAt }}
        </span>
      </div>
      <ul class="vol-list">
        <li v-for="vol in health.volumes" :key="vol.path" :class="{ 'is-bad': !vol.present }">
          <span class="mark" :aria-label="vol.present ? '在' : '不在'">{{ vol.present ? '✓' : '!' }}</span>
          <span>{{ vol.purpose }}</span>
          <span class="dim">{{ vol.path }}</span>
        </li>
      </ul>

      <!-- 后台那轮体检：开关与频率就在这儿设（写进 system_settings，下一个看门周期生效，不用重启），
           下面几行是它上一轮跑出来的结果 -->
      <div v-if="scan" class="vf__scan">
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
        <p class="vf__note">{{ policyText }}</p>

        <div class="vf__row">
          <span class="tag" :class="scanClass">{{ scanText }}</span>
          <span class="tag" :class="sweepClass">{{ sweepText }}</span>
        </div>
        <ul v-if="missingFiles.length" class="missing-list">
          <li v-for="m in missingFiles" :key="m.fileId">
            <router-link :to="`/video/${m.videoId}`" class="dim">{{ m.code || '（无番号）' }}</router-link>
            <span class="dim missing-path" :title="m.path">{{ m.path }}</span>
          </li>
        </ul>
        <p v-if="schedule?.note" class="vf__note">{{ schedule.note }}</p>
        <p class="vf__note">
          一轮体检 = 把库里登记的文件路径都 stat 一遍，再把没量过分辨率的新片补上。
          核对只报证据，不会因此改库：多个版本行指向同一个文件时按路径只数一次，
          卷掉了的时候全部文件都会报"不在"，那时候清记录就是把一次故障变成永久损坏——
          真要删，看着上面这几条自己定。关掉自动体检不影响列表页那个「扫描片源」按钮。
        </p>
      </div>
    </template>

    <div v-else class="rows" aria-busy="true"><div v-for="n in 3" :key="n" class="skeleton row-skeleton"></div></div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { settingApi, systemApi } from '@/scripts/api'
import { useUiStore, errText } from '@/scripts/store/ui'

const ui = useUiStore()

const health = ref(null)
const error = ref('')

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

const load = async () => {
  error.value = ''
  try {
    const res = await systemApi.health()
    if (!res?.success) {
      error.value = res?.message || '读取存储状态失败'
      return
    }
    health.value = res.data
    syncPolicy()
  } catch (err) {
    console.error('读取存储状态失败:', err)
    error.value = '读取存储状态失败：' + errText(err)
  }
}

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

// 到点没到点都不等：手动这一轮同样会刷新"上次/下次"，因为跑一轮就把开始时间落库
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

onMounted(load)
</script>

<style scoped>
.verify {
  display: flex;
  flex-direction: column;
  gap: var(--s2);
}

.vf__row {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--s2);
}

.vf__scan {
  display: flex;
  flex-direction: column;
  gap: var(--s2);
  padding-top: var(--s3);
  border-top: 1px solid var(--border);
}

.vf__note {
  margin: 0;
  color: var(--text-dim);
  font-size: var(--f-xs);
  line-height: 1.6;
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

.vol-list,
.missing-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: var(--s1);
  font-size: var(--f-sm);
}

.vol-list li,
.missing-list li {
  display: flex;
  align-items: baseline;
  gap: var(--s2);
  min-width: 0;
}

/* 一条一行：用途/番号短、路径长，只有路径可以截断 */
.vol-list .dim,
.missing-path {
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
</style>
