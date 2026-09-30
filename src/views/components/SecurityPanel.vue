<template>
  <div class="sec">
    <div class="sec__row">
      <span class="tag" :class="status.enabled ? 'tag--success' : 'tag--muted'">
        {{ status.enabled ? '已开启：破坏性操作要口令' : '未开启：破坏性操作不校验' }}
      </span>
      <span v-if="status.enabled" class="meta">{{ status.masked }}（{{ status.length }} 位）</span>
    </div>

    <p class="sec__note">
      只管删除、改名、批量写这几类接口。浏览、搜索、播放、抓取、扫描都不需要口令；
      没生成口令之前这里是不拦的——开关由你自己按。
    </p>

    <!-- 新口令只回显这一次，所以单独一块并给复制：抄错一位等于把自己锁在库外。
         非安全上下文里 navigator.clipboard 不存在，复制要走 clipboard.js 那条退路 -->
    <div v-if="fresh" class="sec__fresh">
      <span class="sec__fresh-label">新口令（只显示这一次）</span>
      <code class="sec__code">{{ fresh }}</code>
      <button class="btn btn--sm btn--ghost" @click="copy(fresh)">
        {{ copied ? '已复制' : '复制' }}
      </button>
    </div>

    <div class="sec__row">
      <input
        v-model="value"
        class="input grow"
        type="text"
        autocomplete="off"
        placeholder="新口令：留空则随机生成 20 位"
      >
      <input
        v-if="status.enabled"
        v-model="current"
        class="input shrink"
        type="text"
        autocomplete="off"
        placeholder="当前口令"
      >
      <button class="btn btn--primary btn--sm" :disabled="busy" @click="generate">
        {{ status.enabled ? '更新口令' : '生成口令' }}
      </button>
      <button v-if="status.enabled" class="btn btn--sm btn--danger" :disabled="busy" @click="clear">
        关闭校验
      </button>
    </div>

    <p v-if="status.enabled" class="sec__note">
      更新与关闭都要带当前口令，否则绕过就只是"先把口令清掉再删"。
    </p>

    <div class="sec__row">
      <input
        v-model="local"
        class="input grow"
        type="text"
        autocomplete="off"
        :placeholder="savedHere ? '这台设备已存口令（清空即不保存）' : '换设备时把口令粘贴到这里'"
      >
      <button class="btn btn--sm" :disabled="!local.trim()" @click="saveLocal">存到这台设备</button>
    </div>
    <p class="sec__note">
      {{ savedHere
        ? '这台设备已经存了口令，删除/改名会直接带上它。'
        : '这台设备还没存口令，破坏性操作会被服务端拒绝，并提示来这里粘贴。' }}
    </p>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { securityApi } from '@/scripts/api'
import { useUiStore, errText } from '@/scripts/store/ui'
import { getAdminToken, setAdminToken } from '@/scripts/utils/adminToken'
import { copyText } from '@/scripts/utils/clipboard'

const ui = useUiStore()

const status = ref({ enabled: false, masked: '', length: 0 })
const value = ref('')      // 想要的新口令，留空则后端随机生成
const current = ref('')    // 更新/关闭时要验的当前口令
const local = ref(getAdminToken())
const savedHere = ref(!!local.value)
const fresh = ref('')
const copied = ref(false)
const busy = ref(false)

const load = async () => {
  try {
    const res = await securityApi.status()
    if (res?.success) status.value = res.data
  } catch (err) {
    console.error('读取口令状态失败:', err)
    ui.error('读取状态失败：' + errText(err))
  }
}

// 当前口令的来源：这台设备存过就用存的，否则得手动填（换设备后要改口令就是这条路）
const currentForWrite = () => current.value.trim() || getAdminToken()

const generate = async () => {
  busy.value = true
  try {
    const res = await securityApi.set({ value: value.value.trim(), current: currentForWrite() })
    if (!res?.success) {
      ui.error(res?.message || '操作失败')
      return
    }
    fresh.value = res.data?.token || ''
    copied.value = false
    value.value = ''
    current.value = ''
    ui.success(res.message || '已更新')
    await load()
  } catch (err) {
    console.error('更新管理口令失败:', err)
    ui.error('失败：' + errText(err))
  } finally {
    busy.value = false
  }
}

const clear = async () => {
  busy.value = true
  try {
    const res = await securityApi.clear(currentForWrite())
    if (!res?.success) {
      ui.error(res?.message || '关闭失败')
      return
    }
    fresh.value = ''
    current.value = ''
    setAdminToken('')
    local.value = ''
    savedHere.value = false
    ui.success(res.message || '已关闭')
    await load()
  } catch (err) {
    console.error('关闭口令校验失败:', err)
    ui.error('失败：' + errText(err))
  } finally {
    busy.value = false
  }
}

const saveLocal = () => {
  const v = local.value.trim()
  setAdminToken(v)
  savedHere.value = !!v
  ui.success(v ? '已存到这台设备' : '已清除本机保存的口令')
}

const copy = async (text) => {
  if (await copyText(text)) copied.value = true
  else ui.error('复制失败，请手动选中复制')
}

onMounted(load)
</script>

<style scoped>
.sec {
  display: flex;
  flex-direction: column;
  gap: var(--s3);
}

.sec__row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--s2);
}

.sec__note {
  margin: 0;
  color: var(--text-dim);
  font-size: var(--f-sm);
}

/* 新口令这块不用颜色喊：底色 + 等宽字体就够让人停下来读那行说明 */
.sec__fresh {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--s2);
  padding: var(--s2) var(--s3);
  border: 1px solid var(--border);
  border-radius: var(--r2);
  background: var(--bg-soft);
}

.sec__fresh-label {
  font-size: var(--f-sm);
  color: var(--text-dim);
}

.sec__code {
  flex: 1;
  min-width: 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: var(--f-md);
  word-break: break-all;
  user-select: all;
}

/* 口令输入框不抢宽度：它只在"更新/关闭"那一下才需要填 */
.shrink {
  flex: 0 1 14em;
  min-width: 10em;
}
</style>
