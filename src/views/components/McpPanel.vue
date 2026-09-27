<template>
  <div class="mcp">
    <div class="panel-head">
      <div class="panel-head__text">
        <h3 class="panel-title">AI 接口（MCP）</h3>
        <p class="panel-desc">
          给本机大模型留的口子：一个 <code>/mcp</code> 端点 + <code>X-API-Key</code> 头。
          目前全是只读——模型看得懂整个库，改不动整个库。
        </p>
      </div>
      <button class="btn btn--sm btn--primary" :disabled="busy" @click="rotate">
        {{ status.key ? '重新生成密钥' : '生成密钥' }}
      </button>
    </div>

    <p v-if="error" class="notice notice--error" role="alert">
      <span>{{ error }}</span>
      <button class="btn btn--sm" @click="load">重试</button>
    </p>

    <p v-else-if="!loading && !status.key" class="notice">
      还没生成密钥，<code>/mcp</code> 对任何请求都回 401。开门要点右上「生成密钥」。
    </p>

    <ul class="rows">
      <li class="row">
        <div class="row-main">
          <span class="row-title">端点</span>
          <div class="row-sub"><code>{{ status.endpoint }}</code></div>
        </div>
        <div class="row-actions">
          <button class="btn btn--sm btn--ghost" @click="copy('endpoint', status.endpoint)">
            {{ copied === 'endpoint' ? '已复制' : '复制' }}
          </button>
        </div>
      </li>

      <li class="row">
        <div class="row-main">
          <span class="row-title">密钥</span>
          <div class="row-sub">
            <code v-if="reveal || !status.key">{{ masked }}</code>
            <code v-else>{{ hide(status.key) }}</code>
          </div>
        </div>
        <div class="row-actions">
          <button v-if="status.key" class="btn btn--sm btn--ghost" @click="reveal = !reveal">
            {{ reveal ? '隐藏' : '显示' }}
          </button>
          <button
            class="btn btn--sm btn--ghost"
            :disabled="!status.key"
            @click="copy('key', status.key)"
          >
            {{ copied === 'key' ? '已复制' : '复制' }}
          </button>
        </div>
      </li>
    </ul>

    <div class="field">
      <span class="field__label">客户端配置</span>
      <p class="hint">
        大多数 MCP 客户端（Bionic、Cherry Studio、Claude Desktop 等）要的是这么一段，粘进去即可。
        换过密钥要重新粘一次，配置里留的是旧串。
      </p>
      <pre class="code">{{ snippet }}</pre>
      <div class="row-actions">
        <button class="btn btn--sm btn--ghost" :disabled="!status.key" @click="copy('snippet', snippet)">
          {{ copied === 'snippet' ? '已复制' : '复制配置' }}
        </button>
      </div>
    </div>

    <div class="field">
      <span class="field__label">工具清单（{{ status.tools.length }} 个）</span>
      <table class="grid-table">
        <thead>
          <tr><th>名称</th><th>做什么</th></tr>
        </thead>
        <tbody>
          <tr v-for="t in status.tools" :key="t.name">
            <td><code>{{ t.name }}</code></td>
            <td class="dim" :title="t.description">{{ brief(t.description) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

  </div>
</template>

<script setup>
import { computed, onUnmounted, ref } from 'vue'
import { mcpApi } from '@/scripts/api'
import { useUiStore, errText } from '@/scripts/store/ui'
import { copyText } from '@/scripts/utils/clipboard'

const ui = useUiStore()

const loading = ref(true)
const busy = ref(false)
const error = ref('')
const reveal = ref(false)
const copied = ref('')
const status = ref({ endpoint: '', key: '', enabled: false, tools: [] })

let copyTimer = null
const flash = (which) => {
  copied.value = which
  clearTimeout(copyTimer)
  copyTimer = setTimeout(() => { copied.value = '' }, 1500)
}

onUnmounted(() => clearTimeout(copyTimer))

const masked = computed(() => status.value.key || '（还没生成）')

/** 密钥默认只露个头，全屏是 * 反而看不出到底配没配上 */
const hide = (key) => (key ? `${key.slice(0, 4)}${'*'.repeat(Math.max(key.length - 4, 4))}` : '')

const snippet = computed(() => JSON.stringify(
  {
    mcpServers: {
      'ckapi-media': {
        url: status.value.endpoint,
        headers: { 'X-API-Key': status.value.key || '先生成密钥' }
      }
    }
  },
  null,
  2
))

/** 表格里只放第一句，完整说明挂在 title 上 */
const brief = (text) => {
  const s = String(text || '').split('\n')[0]
  const stop = s.indexOf('。')
  return stop > 0 ? s.slice(0, stop + 1) : s
}

const load = async () => {
  loading.value = true
  error.value = ''
  try {
    const res = await mcpApi.status()
    if (!res?.success) throw new Error(res?.message || '加载失败')
    status.value = { tools: [], ...res.data }
  } catch (err) {
    error.value = 'MCP 状态加载失败：' + errText(err)
  } finally {
    loading.value = false
  }
}

const copy = async (which, text) => {
  if (!text) return
  if (await copyText(text)) flash(which)
  else ui.error('复制失败，请手动选中')
}

const rotate = async () => {
  const go = await ui.confirm({
    title: status.value.key ? '重新生成密钥' : '生成密钥',
    message: status.value.key
      ? '旧密钥当场失效，已经配好的客户端要一起换成新的，否则全部 401。'
      : '生成之后 /mcp 才开始接客；在此之前它一律拒绝。',
    confirmLabel: '生成',
    danger: !!status.value.key
  })
  if (!go) return
  busy.value = true
  try {
    const res = await mcpApi.rotateKey()
    if (res.success) {
      status.value.key = res.data.key
      status.value.enabled = true
      reveal.value = true
      ui.success(res.message)
    } else ui.error(res.message || '没生成')
  } catch (err) {
    ui.error('失败：' + errText(err))
  } finally {
    busy.value = false
  }
}

load()
</script>

<style scoped>
.mcp {
  display: flex;
  flex-direction: column;
  gap: var(--s4);
  min-width: 0;
}

.panel-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--s3);
  flex-wrap: wrap;
}

.panel-head__text {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.panel-title {
  font-size: var(--f-lg);
  font-weight: 600;
}

.panel-desc {
  font-size: var(--f-sm);
  color: var(--text-dim);
  line-height: 1.6;
}

.rows {
  display: flex;
  flex-direction: column;
  gap: var(--s2);
  list-style: none;
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--s3);
  flex-wrap: wrap;
  padding: var(--s3);
  background: var(--bg-elev-2);
  border: 1px solid var(--border);
  border-radius: var(--r1);
}

.row-main {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  flex: 1;
}

.row-title {
  font-size: var(--f-sm);
  font-weight: 600;
}

.row-sub {
  min-width: 0;
}

.row-actions {
  display: flex;
  gap: var(--s2);
  flex-wrap: wrap;
}

.hint {
  font-size: var(--f-xs);
  color: var(--text-dim);
  line-height: 1.6;
}

/* 配置与密钥都是要照着抄的，禁不了换行也得能整段选中 */
.code,
.row-sub code,
.grid-table code {
  display: block;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: var(--f-xs);
  line-height: 1.6;
  color: var(--text);
  word-break: break-all;
}

.code {
  padding: var(--s3);
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: var(--r1);
  overflow-x: auto;
  white-space: pre;
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

.grid-table td code {
  display: inline;
}

.dim {
  color: var(--text-dim);
}
</style>
