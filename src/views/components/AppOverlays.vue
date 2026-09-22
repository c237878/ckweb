<template>
  <!-- 反馈层：toast 栈 + 全局确认对话框。整个应用只挂这一份。 -->
  <div class="toaster" aria-live="polite" aria-atomic="false">
    <TransitionGroup name="toast">
      <div
        v-for="t in ui.toasts"
        :key="t.id"
        class="toast"
        :class="`toast--${t.type}`"
        :role="t.type === 'error' ? 'alert' : 'status'"
      >
        <span class="toast__msg">{{ t.message }}</span>
        <button class="toast__close" type="button" aria-label="关闭提示" @click="ui.dismiss(t.id)">
          &times;
        </button>
      </div>
    </TransitionGroup>
  </div>

  <div v-if="ui.dialog" class="overlay" @click.self="cancel">
    <div
      class="dialog dialog--sm"
      role="alertdialog"
      aria-modal="true"
      :aria-labelledby="titleId"
      ref="panel"
    >
      <div class="dialog__head">
        <h3 class="dialog__title" :id="titleId">{{ ui.dialog.title }}</h3>
        <button class="dialog__close" type="button" aria-label="关闭" @click="cancel">&times;</button>
      </div>
      <div class="dialog__body" v-if="ui.dialog.message">{{ ui.dialog.message }}</div>
      <div class="dialog__foot">
        <button class="btn" type="button" @click="cancel">{{ ui.dialog.cancelLabel }}</button>
        <button
          v-for="action in ui.dialog.actions"
          :key="action.value"
          type="button"
          class="btn"
          :class="{ 'btn--primary': action.primary, 'btn--danger': action.danger }"
          @click="ui.settle(action.value)"
        >
{{ action.label }}
</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useUiStore } from '@/scripts/store/ui'

const ui = useUiStore()
const panel = ref(null)
const titleId = `ui-dialog-title`

let opener = null

// 同一时刻只允许一个对话框，所以焦点管理不需要栈
watch(() => ui.dialog, async (dialog) => {
  if (dialog) {
    opener = document.activeElement
    await nextTick()
    // 默认聚焦主操作；没有主操作就聚焦第一个按钮
    const target = panel.value?.querySelector('.btn--primary, .btn--danger') || panel.value?.querySelector('.btn')
    target?.focus()
    document.body.style.overflow = 'hidden'
  } else {
    document.body.style.overflow = ''
    if (opener?.focus && document.contains(opener)) opener.focus()
    opener = null
  }
})

const cancel = () => ui.settle('cancel')

const onKeydown = (event) => {
  if (event.key === 'Escape' && ui.dialog) {
    event.stopPropagation()
    cancel()
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown, true))
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown, true)
  document.body.style.overflow = ''
})
</script>

<style scoped>
.toaster {
  position: fixed;
  top: var(--s4);
  right: var(--s4);
  z-index: var(--z-lightbox);
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--s2);
  max-width: min(420px, calc(100vw - var(--s6)));
  pointer-events: none;
}

.toast {
  display: flex;
  align-items: flex-start;
  gap: var(--s2);
  padding: 10px 12px;
  border-radius: var(--r2);
  border: 1px solid var(--border);
  background: var(--bg-elev);
  box-shadow: var(--shadow-2);
  color: var(--text);
  font-size: var(--f-sm);
  line-height: 1.5;
  pointer-events: auto;
  border-left: 3px solid var(--border-strong);
}

.toast--error { border-left-color: var(--danger); }
.toast--success { border-left-color: var(--success); }
.toast--warn { border-left-color: var(--warn); }
.toast--info { border-left-color: var(--info); }

.toast__msg {
  flex: 1;
  word-break: break-word;
  white-space: pre-wrap;
}

.toast__close {
  flex-shrink: 0;
  width: 18px;
  height: 18px;
  display: grid;
  place-items: center;
  border-radius: var(--rp);
  color: var(--text-faint);
  font-size: var(--f-lg);
  line-height: 1;
}

.toast__close:hover {
  background: var(--bg-hover);
  color: var(--text);
}

.toast-enter-active,
.toast-leave-active {
  transition: opacity var(--dur) var(--ease), transform var(--dur) var(--ease);
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(12px);
}

.toast-leave-to {
  position: absolute;
  right: 0;
}
</style>
