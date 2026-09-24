<template>
  <div class="chips">
    <div class="chips__list">
      <span v-for="(value, i) in modelValue" :key="value" class="tag tag--accent chip">
        {{ value }}
        <button type="button" class="chip__x" :aria-label="`移除 ${value}`" @click="remove(i)">&times;</button>
      </span>
      <span v-if="!modelValue.length" class="chips__empty">{{ emptyText }}</span>
    </div>

    <div class="chips__add">
      <input
        v-model.trim="draft"
        class="input"
        type="text"
        :maxlength="maxLength"
        :placeholder="placeholder"
        :aria-label="label"
        @keyup.enter.prevent="add"
      />
      <button type="button" class="btn btn--sm" :disabled="!draft || full" @click="add">添加</button>
    </div>

    <p v-if="hint" class="chips__hint">{{ hint }}</p>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useUiStore } from '@/scripts/store/ui'

/**
 * 字符串数组型的小标签编辑器（演员曾用名等）。
 * 与 TaxonomyTable 的区别：那个管的是全局数据源、带引用计数与改名级联；
 * 这里只是"一条记录身上的几个值"，父组件拿到什么就存什么。
 */
const props = defineProps({
  modelValue: { type: Array, default: () => [] },
  /** 输入框的无障碍名 */
  label: { type: String, required: true },
  placeholder: { type: String, default: '输入后回车添加' },
  hint: { type: String, default: '' },
  emptyText: { type: String, default: '暂无内容' },
  maxLength: { type: Number, default: 60 },
  max: { type: Number, default: 20 }
})

const emit = defineEmits(['update:modelValue'])
const ui = useUiStore()

const draft = ref('')

const full = computed(() => props.modelValue.length >= props.max)

const commit = (next) => emit('update:modelValue', next)

const add = () => {
  const value = draft.value.trim()
  if (!value) return
  if (props.modelValue.includes(value)) {
    ui.warn(`「${value}」已在列表里`)
    return
  }
  if (full.value) {
    ui.warn(`最多 ${props.max} 个`)
    return
  }
  commit([...props.modelValue, value])
  draft.value = ''
}

const remove = (index) => {
  const next = props.modelValue.slice()
  next.splice(index, 1)
  commit(next)
}
</script>

<style scoped>
.chips {
  display: flex;
  flex-direction: column;
  gap: var(--s2);
  min-width: 0;
}

.chips__list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s1);
  min-height: var(--ctl-h-xs);
}

.chip {
  gap: var(--s1);
  padding-right: var(--ctl-pad-x-xs);
}

.chip__x {
  display: grid;
  place-items: center;
  width: 16px;
  height: 16px;
  border-radius: var(--rp);
  color: inherit;
  font-size: var(--f-md);
  line-height: 1;
  opacity: .6;
  cursor: pointer;
  transition: opacity var(--dur) var(--ease), background var(--dur) var(--ease);
}

.chip__x:hover {
  opacity: 1;
  background: var(--bg-hover);
}

.chips__empty {
  font-size: var(--f-sm);
  color: var(--text-faint);
}

.chips__add {
  display: flex;
  align-items: center;
  gap: var(--s2);
}

.chips__add .input {
  flex: 1;
  min-width: 0;
}

.chips__hint {
  font-size: var(--f-xs);
  color: var(--text-faint);
  line-height: 1.6;
}
</style>
