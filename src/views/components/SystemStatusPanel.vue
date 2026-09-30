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
      下面的检查只跑纯 SQL（几十毫秒）。要看"文件是不是真的还在盘上""封面有没有缺"
      那种得逐条 stat 挂载卷的检查，那是另一个任务，不放在这个页面里同步跑。
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
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { systemApi } from '@/scripts/api'

const data = ref(null)
const backups = ref(null)
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
    const [c, b] = await Promise.all([systemApi.checks(), systemApi.backups()])
    if (!c?.success) {
      error.value = c?.message || '体检失败'
      return
    }
    data.value = c.data
    backups.value = b?.success ? b.data : null
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

const sizeText = (bytes) => (bytes >= 1048576
  ? `${(bytes / 1048576).toFixed(1)} MB`
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
