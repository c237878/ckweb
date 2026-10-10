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
      这里只跑纯 SQL 的记录关系检查（几十毫秒），一个字的盘都不碰。
      "文件是不是真的还在盘上"那种要逐条 stat 挂载卷的核对在「片源核对」那一格，
      快照与恢复在「备份与恢复」，按码率挑文件与按指纹挑重复在「文件分析」。
    </p>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { systemApi } from '@/scripts/api'

const data = ref(null)
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
    const res = await systemApi.checks()
    if (!res?.success) {
      error.value = res?.message || '体检失败'
      return
    }
    data.value = res.data
  } catch (err) {
    console.error('系统自检失败:', err)
    error.value = '体检失败：请确认后端服务可用'
  } finally {
    loading.value = false
  }
}

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

.sys-status__foot {
  margin: 0;
  color: var(--text-dim);
  font-size: var(--f-xs);
  line-height: 1.6;
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
</style>
