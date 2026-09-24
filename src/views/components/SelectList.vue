<template>
  <div class="select-list dropdown" ref="root" :class="{ 'is-open': open, 'is-disabled': disabled }">
    <button
      type="button"
      class="select-list__trigger"
      :id="triggerId"
      :disabled="disabled"
      :aria-haspopup="'listbox'"
      :aria-expanded="open ? 'true' : 'false'"
      :aria-label="label"
      :aria-activedescendant="open && highlight >= 0 ? optionId(highlight) : undefined"
      ref="triggerEl"
      @click="toggle"
      @keydown="onKeydown"
      @blur="onBlur"
    >
      <span class="select-list__text" :class="{ 'is-placeholder': !selectedLabel }">{{ selectedLabel || placeholder }}</span>
    </button>

    <ul
      v-if="open"
      :id="listboxId"
      ref="listEl"
      class="dropdown-menu"
      role="listbox"
      :aria-labelledby="label ? triggerId : undefined"
    >
      <li
        v-for="(opt, i) in items"
        :key="`${opt.value}-${i}`"
        :id="optionId(i)"
        class="dropdown-option"
        role="option"
        :class="{ active: isSame(opt.value), 'is-hl': highlight === i }"
        :aria-selected="isSame(opt.value)"
        @mousedown.prevent="choose(opt)"
        @mouseenter="highlight = i"
      >
{{ opt.label }}
      </li>
      <li v-if="items.length === 0" class="dropdown-empty">无可选项</li>
    </ul>
  </div>
</template>

<script setup>
import { computed, nextTick, onUnmounted, ref, useId } from 'vue'
import { autoFitDropdown } from '@/scripts/utils/dropdownFit'

const props = defineProps({
  modelValue: { type: [String, Number], default: '' },
  /** [{ value, label }] 或纯字符串数组；数字值请传对象，别用 v-model.number */
  options: { type: Array, default: () => [] },
  placeholder: { type: String, default: '请选择' },
  /** 顶部"全部 xxx"项文案，传空串则不渲染 */
  allLabel: { type: String, default: '' },
  /** 触发按钮的无障碍名，页面上没有可见 label 时必须给 */
  label: { type: String, default: '' },
  disabled: { type: Boolean, default: false }
})

const emit = defineEmits(['update:modelValue', 'change'])

const uid = useId()
const triggerId = `${uid}-t`
const listboxId = `${uid}-l`
const optionId = (i) => `${uid}-o${i}`

const open = ref(false)
const highlight = ref(-1)
const root = ref(null)
const triggerEl = ref(null)
const listEl = ref(null)
// 面板展开期间的自适应跟随，收起时要把监听摘掉
let stopFit = null

const items = computed(() => {
  const normalized = props.options.map((o) =>
    typeof o === 'object' && o !== null ? { value: o.value, label: o.label ?? o.value } : { value: o, label: o }
  )
  return props.allLabel ? [{ value: '', label: props.allLabel }, ...normalized] : normalized
})

const isSame = (value) => value === props.modelValue

const selectedLabel = computed(
  () => items.value.find((o) => isSame(o.value))?.label ?? ''
)

const selectedIndex = () => items.value.findIndex((o) => isSame(o.value))

const clamp = (n) => {
  const max = items.value.length - 1
  if (max < 0) return -1
  return n < 0 ? max : n > max ? 0 : n
}

const openMenu = () => {
  if (props.disabled || items.value.length === 0) return
  highlight.value = selectedIndex()
  open.value = true
  document.addEventListener('mousedown', onOutside, true)
  nextTick(() => {
    stopFit?.()
    stopFit = autoFitDropdown(listEl.value, root.value)
  })
}

const closeMenu = () => {
  open.value = false
  highlight.value = -1
  document.removeEventListener('mousedown', onOutside, true)
  stopFit?.()
  stopFit = null
}

// 面板是 button 的兄弟节点，点在组件外才收，点在内由选项自己的 mousedown 处理
function onOutside(event) {
  if (root.value && !root.value.contains(event.target)) closeMenu()
}

onUnmounted(() => {
  document.removeEventListener('mousedown', onOutside, true)
  stopFit?.()
})

const toggle = () => (open.value ? closeMenu() : openMenu())

const choose = (opt) => {
  closeMenu()
  if (opt.value !== props.modelValue) {
    emit('update:modelValue', opt.value)
    emit('change', opt.value)
  }
  triggerEl.value?.focus()
}

const move = (delta) => {
  if (!open.value) {
    openMenu()
    return
  }
  highlight.value = clamp(highlight.value + delta)
}

const onKeydown = (event) => {
  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault()
      move(1)
      break
    case 'ArrowUp':
      event.preventDefault()
      move(-1)
      break
    case 'Home':
      if (open.value) { event.preventDefault(); highlight.value = 0 }
      break
    case 'End':
      if (open.value) { event.preventDefault(); highlight.value = items.value.length - 1 }
      break
    case 'Enter':
    case ' ':
      event.preventDefault()
      if (open.value && highlight.value >= 0) choose(items.value[highlight.value])
      else openMenu()
      break
    case 'Escape':
      if (open.value) { event.preventDefault(); closeMenu() }
      break
    case 'Tab':
      closeMenu()
      break
  }
}

const onBlur = () => {
  if (open.value) closeMenu()
}
</script>

<style scoped>
.select-list__trigger {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--s2);
  width: 100%;
  height: var(--ctl-h);
  padding-inline: var(--ctl-pad-x-sm);
  padding-right: 28px;
  border: 1px solid var(--border);
  border-radius: var(--r1);
  background: var(--bg-input);
  color: var(--text);
  font-size: var(--f-md);
  line-height: 1;
  text-align: left;
  cursor: pointer;
  transition: border-color var(--dur) var(--ease), box-shadow var(--dur) var(--ease);
}

.select-list__trigger:hover:not(:disabled) {
  border-color: var(--border-strong);
}

.select-list__trigger:disabled {
  opacity: .5;
  cursor: not-allowed;
}

/* 与全局 .select 同一个箭头 */
.select-list__trigger::after {
  content: '';
  position: absolute;
  right: 12px;
  width: 7px;
  height: 7px;
  border-right: 1.5px solid var(--text-dim);
  border-bottom: 1.5px solid var(--text-dim);
  transform: rotate(45deg) translateY(-2px);
  transition: transform var(--dur) var(--ease);
}

.select-list.dropdown:focus-within .select-list__trigger,
.select-list__trigger:focus-visible {
  border-color: var(--accent);
  box-shadow: none;
}

.is-open .select-list__trigger::after {
  transform: rotate(-135deg) translateY(-2px);
}

.select-list__text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.select-list__text.is-placeholder {
  color: var(--text-faint);
}
</style>
