<template>
  <div class="option-list">
    <div class="option-list__items">
      <span v-for="(item, i) in items" :key="item" class="tag tag--accent option-list__item">
        {{ item }}
        <button
          type="button"
          class="option-list__x"
          :aria-label="`移除 ${item}`"
          @click="remove(i)"
        >&times;</button>
      </span>
      <span v-if="items.length === 0" class="option-list__empty">还没有可选值，在下方添加</span>
    </div>

    <div class="option-list__add">
      <input
        v-model.trim="draft"
        class="input"
        type="text"
        :placeholder="placeholder"
        maxlength="20"
        :aria-label="label"
        @keyup.enter="add"
      />
      <button type="button" class="btn btn--sm" :disabled="!canAdd" @click="add">添加</button>
    </div>

    <p v-if="hint" class="option-list__hint">{{ hint }}</p>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useUiStore } from '@/scripts/store/ui'

const props = defineProps({
  /** 逗号分隔的原始设置值，父子之间不做二次转换 */
  modelValue: { type: String, default: '' },
  label: { type: String, required: true },
  placeholder: { type: String, default: '输入后回车添加' },
  hint: { type: String, default: '' }
})

const emit = defineEmits(['update:modelValue'])
const ui = useUiStore()

const draft = ref('')

const items = computed(() =>
  (props.modelValue || '').split(',').map((s) => s.trim()).filter(Boolean)
)

const canAdd = computed(() => !!draft.value)

const commit = (next) => emit('update:modelValue', next.join(','))

const add = () => {
  const value = draft.value.trim()
  if (!value) return
  if (items.value.includes(value)) {
    ui.warn(`「${value}」已在列表中`)
    return
  }
  commit([...items.value, value])
  draft.value = ''
}

const remove = (index) => {
  const next = items.value.slice()
  const [gone] = next.splice(index, 1)
  commit(next)
  // 从列表删掉不等于删掉历史记录里的这个值：那些影片/演员仍然带着它
  ui.info(`已从可选值中移除「${gone}」，已使用它的记录不受影响`)
}
</script>

<style scoped>
.option-list {
  display: flex;
  flex-direction: column;
  gap: var(--s2);
}

.option-list__items {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s1);
  min-height: var(--ctl-h-xs);
}

.option-list__empty {
  font-size: var(--f-sm);
  color: var(--text-faint);
}

.option-list__item {
  padding-right: var(--ctl-pad-x-xs);
  gap: var(--s1);
}

.option-list__x {
  display: grid;
  place-items: center;
  width: 16px;
  height: 16px;
  border-radius: var(--rp);
  color: inherit;
  font-size: var(--f-md);
  line-height: 1;
  opacity: .6;
  transition: opacity var(--dur) var(--ease), background var(--dur) var(--ease);
}

.option-list__x:hover {
  opacity: 1;
  background: var(--bg-hover);
}

.option-list__add {
  display: flex;
  align-items: center;
  gap: var(--s2);
  max-width: 360px;
}

.option-list__add .input {
  flex: 1;
  min-width: 0;
}

.option-list__hint {
  font-size: var(--f-xs);
  color: var(--text-faint);
  line-height: 1.6;
}
</style>
