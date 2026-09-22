<template>
  <div
    v-if="visible"
    class="overlay"
    @mousedown="handleOverlayDown"
    @click="handleOverlayClick"
  >
    <div
      ref="panel"
      class="dialog"
      :class="size ? `dialog--${size}` : ''"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="titleId"
      tabindex="-1"
    >
      <div class="dialog__head">
        <h3 class="dialog__title" :id="titleId">{{ title }}</h3>
        <button type="button" class="dialog__close" aria-label="关闭" @click="handleCancel">
          &times;
        </button>
      </div>

      <div class="dialog__body">
        <slot name="content">
          <slot />
        </slot>
      </div>

      <div class="dialog__foot">
        <slot name="extra-actions"></slot>
        <slot name="actions">
          <button type="button" class="btn" @click="handleCancel">{{ cancelText }}</button>
          <button type="button" class="btn btn--primary" @click="handleConfirm">{{ confirmText }}</button>
        </slot>
      </div>
    </div>
  </div>
</template>

<script>
/* 这一段是模块作用域：整份组件共用，跨实例生效 */

// 对话框可以叠加（表单上再弹一层确认），键盘事件只归最上面那层处理
const openStack = []
// 滚动锁按引用计数，别让先关的那个把页面放开
let locked = 0
let savedOverflow = ''

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(',')
</script>

<script setup>
import { nextTick, onBeforeUnmount, ref, useId, watch } from 'vue'

const props = defineProps({
  visible: Boolean,
  title: { type: String, default: '' },
  /** 宽度档位：'' | sm | wide | full，缺省用 main.css 的 .dialog 默认宽 */
  size: { type: String, default: '' },
  confirmText: { type: String, default: '保存' },
  cancelText: { type: String, default: '取消' },
  /** 点遮罩是否关闭。表单类对话框保持 true，行为与迁移前一致 */
  closeOnBackdrop: { type: Boolean, default: true }
})

const emit = defineEmits(['update:visible', 'confirm', 'cancel'])

const panel = ref(null)

// 同一页面可能并存多个对话框，标题要各自有 id 供 aria-labelledby 指向
const titleId = `dialog-title-${useId()}`
// 打开前的焦点元素，关闭后还回去
let opener = null

/* ---------------------------------------------------------------
   焦点与滚动锁
   对话框是受控组件（visible 由父级决定），所以这些副作用全部挂在
   watch(visible) 上，组件卸载时也要兜底清理。
   --------------------------------------------------------------- */

const isVisible = (el) => el.getClientRects().length > 0

const focusables = () => {
  const root = panel.value
  if (!root) return []
  return Array.from(root.querySelectorAll(FOCUSABLE)).filter(isVisible)
}

// 打开时优先落在第一个表单控件上，别停在关闭按钮
const focusFirstField = () => {
  const list = focusables()
  const inBody = list.find((el) => el.closest('.dialog__body'))
  ;(inBody || panel.value)?.focus()
}

const onKeyDown = (e) => {
  if (openStack[openStack.length - 1] !== onKeyDown) return

  if (e.key === 'Escape') {
    // 输入框自带的下拉展开时，这一次 Esc 归它自己收（ComboBox 已处理）
    const el = document.activeElement
    if (el?.getAttribute?.('aria-expanded') === 'true') return
    e.preventDefault()
    handleCancel()
    return
  }

  if (e.key !== 'Tab') return
  const list = focusables()
  if (list.length === 0) {
    e.preventDefault()
    panel.value?.focus()
    return
  }
  const first = list[0]
  const last = list[list.length - 1]
  const active = document.activeElement
  if (!panel.value.contains(active)) {
    e.preventDefault()
    ;(e.shiftKey ? last : first).focus()
    return
  }
  if (e.shiftKey && (active === first || active === panel.value)) {
    e.preventDefault()
    last.focus()
  } else if (!e.shiftKey && active === last) {
    e.preventDefault()
    first.focus()
  }
}

const activate = () => {
  opener = document.activeElement
  if (locked === 0) {
    savedOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  }
  locked++
  document.addEventListener('keydown', onKeyDown)
  openStack.push(onKeyDown)
  nextTick(focusFirstField)
}

const deactivate = (restoreFocus) => {
  const i = openStack.indexOf(onKeyDown)
  if (i > -1) openStack.splice(i, 1)
  document.removeEventListener('keydown', onKeyDown)
  locked = Math.max(0, locked - 1)
  if (locked === 0) document.body.style.overflow = savedOverflow

  const from = opener
  opener = null
  if (restoreFocus && from?.focus && document.contains(from)) from.focus()
}

watch(() => props.visible, (val, prev) => {
  if (val && !prev) activate()
  else if (!val && prev) deactivate(true)
}, { immediate: true })

onBeforeUnmount(() => {
  if (props.visible) deactivate(false)
})

/* ---------------------------------------------------------------
   遮罩点击
   关键：不在 click 里重置 flag，让它保持到下次 mousedown 再覆盖。
   只有"按下"和"抬起"都落在遮罩上才算点空白，否则是在对话框里选文字。
   --------------------------------------------------------------- */

let mouseDownOnDialog = false

function handleOverlayDown(e) {
  mouseDownOnDialog = !!panel.value?.contains(e.target)
}

function handleOverlayClick() {
  if (props.closeOnBackdrop && !mouseDownOnDialog) handleCancel()
}

// 内置按钮的契约：点确认即关闭。需要"校验不通过就留在弹窗里"的调用方
// 不要用内置 actions，传 #actions 自己放按钮并自行控制 visible。
const handleConfirm = () => {
  emit('confirm')
  emit('update:visible', false)
}

const handleCancel = () => {
  emit('cancel')
  emit('update:visible', false)
}
</script>

<style scoped>
/* 只补宽度档位，其余外观全部来自 main.css 的遮罩与对话框类 */
.dialog--sm {
  max-width: 440px;
}

.dialog--wide {
  max-width: 760px;
}

.dialog--full {
  max-width: 1000px;
}
</style>
