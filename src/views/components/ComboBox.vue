<template>
  <div class="combobox" ref="root">
    <input
      class="input"
      ref="inputEl"
      type="text"
      :value="text"
      :placeholder="placeholder"
      :aria-expanded="open ? 'true' : 'false'"
      aria-autocomplete="list"
      role="combobox"
      autocomplete="off"
      @input="onInput"
      @focus="open = true"
      @keydown.down.prevent="move(1)"
      @keydown.up.prevent="move(-1)"
      @keydown.enter.prevent="commit(highlight)"
      @keydown.esc="open = false"
      @blur="onBlur"
    />
    <button
      v-if="modelValue"
      type="button"
      class="clear"
      aria-label="清除选择"
      @mousedown.prevent="clear"
    >
&times;
</button>

    <ul v-if="open" class="combobox-list" role="listbox">
      <li
        v-if="allLabel"
        class="combobox-option"
        :class="{ active: !modelValue, 'is-hl': highlight === -1 }"
        role="option"
        :aria-selected="!modelValue"
        @mousedown.prevent="choose(null)"
      >
{{ allLabel }}
</li>
      <li
        v-for="(opt, i) in visible"
        :key="opt.id"
        class="combobox-option"
        :class="{ active: opt.id === modelValue, 'is-hl': highlight === i }"
        role="option"
        :aria-selected="opt.id === modelValue"
        @mousedown.prevent="choose(opt)"
        @mouseenter="highlight = i"
      >
{{ opt.name }}
</li>
      <li v-if="visible.length === 0" class="combobox-empty">无匹配项</li>
    </ul>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'

const props = defineProps({
  modelValue: { type: String, default: '' },
  /** [{ id, name }] */
  options: { type: Array, default: () => [] },
  placeholder: { type: String, default: '搜索...' },
  /** 顶部"全部 xxx"项的文案，传空串则不显示 */
  allLabel: { type: String, default: '全部' },
  /** 下拉最多渲染多少条，避免 700+ 系列一次性铺满 DOM */
  limit: { type: Number, default: 50 }
})

const emit = defineEmits(['update:modelValue', 'change'])

const open = ref(false)
const text = ref('')
const highlight = ref(-1)
const inputEl = ref(null)

const selected = computed(() =>
  props.options.find((o) => o.id === props.modelValue) || null
)

// 用户正在敲字时不要被 modelValue 的变化反向清掉输入框
let typing = false

watch(selected, (val) => {
  if (!typing) text.value = val ? val.name : ''
}, { immediate: true })

watch(() => props.modelValue, (val) => {
  if (!val && !typing) text.value = ''
})

const visible = computed(() => {
  const kw = text.value.trim().toLowerCase()
  const list = kw
    ? props.options.filter((o) => (o.name || '').toLowerCase().includes(kw))
    : props.options
  return list.slice(0, props.limit)
})

watch(visible, () => { highlight.value = -1 })

const onInput = (event) => {
  typing = true
  text.value = event.target.value
  open.value = true
  // 开始改关键字就先取消已选中的项，避免"看着是搜索 NTR、实际还在按旧系列过滤"
  if (props.modelValue) emit('update:modelValue', '')
  nextTick(() => { typing = false })
}

const move = (delta) => {
  if (!open.value) { open.value = true; return }
  const max = visible.value.length - 1
  const next = highlight.value + delta
  highlight.value = next < -1 ? max : next > max ? -1 : next
}

const choose = (opt) => {
  const value = opt ? opt.id : ''
  typing = false
  text.value = opt ? opt.name : ''
  open.value = false
  if (value !== props.modelValue) {
    emit('update:modelValue', value)
    emit('change', value)
  }
}

const commit = (index) => {
  if (index === -1) return choose(null)
  const opt = visible.value[index]
  if (opt) choose(opt)
}

const clear = () => choose(null)

const onBlur = () => {
  // 用 nextTick 让 mousedown.prevent 的选项点击先完成
  nextTick(() => { open.value = false })
}
</script>

<style scoped>
.combobox {
  position: relative;
  min-width: 160px;
}

.combobox .input {
  padding-right: 26px;
}

.clear {
  position: absolute;
  top: 50%;
  right: 6px;
  transform: translateY(-50%);
  width: 18px;
  height: 18px;
  border-radius: var(--rp);
  color: var(--text-faint);
  font-size: var(--f-lg);
  line-height: 1;
  display: grid;
  place-items: center;
}

.clear:hover {
  color: var(--danger);
  background: var(--bg-hover);
}

.combobox-list {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  z-index: 30;
  max-height: 288px;
  overflow-y: auto;
  list-style: none;
  padding: 4px;
  background: var(--bg-elev);
  border: 1px solid var(--border-strong);
  border-radius: var(--r1);
  box-shadow: var(--shadow-2);
}

.combobox-option {
  padding: 6px 9px;
  border-radius: var(--r1);
  font-size: var(--f-md);
  color: var(--text-dim);
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.combobox-option:hover,
.combobox-option.is-hl {
  background: var(--bg-hover);
  color: var(--text);
}

.combobox-option.active {
  background: var(--accent-soft);
  color: var(--accent);
  font-weight: 600;
}

.combobox-empty {
  padding: 6px 9px;
  color: var(--text-faint);
  font-size: var(--f-sm);
}
</style>
