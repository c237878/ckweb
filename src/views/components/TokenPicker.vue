<template>
  <div class="picker">
    <span
      v-for="(item, i) in modelValue"
      :key="item.id || item.name"
      class="tag picker__chip"
      :class="chipClass"
    >
      {{ item.name }}
      <button
        type="button"
        class="picker__x"
        :aria-label="`移除 ${item.name}`"
        @click="removeAt(i)"
      >&times;</button>
    </span>

    <span class="picker__input-wrap">
      <input
        v-model="draft"
        class="input picker__input"
        :placeholder="placeholder"
        autocomplete="off"
        @focus="open = true"
        @input="open = true"
        @keydown.down.prevent="move(1)"
        @keydown.up.prevent="move(-1)"
        @keydown.enter.prevent="pick(active >= 0 ? matches[active] : null)"
        @keydown.esc="open = false"
        @blur="closeSoon"
      />
      <!-- 自己画下拉而不是用 datalist：浏览器给 datalist 弹的是系统浅色面板，暗色主题下像另一个网站 -->
      <ul v-if="open && matches.length" class="picker__list" role="listbox">
        <li
          v-for="(m, i) in matches"
          :key="m.id"
          :class="{ 'is-active': i === active }"
          role="option"
          :aria-selected="i === active"
          @mousedown.prevent="pick(m)"
        >
          {{ m.name }}
          <span v-if="m.hint" class="picker__hint">{{ m.hint }}</span>
        </li>
      </ul>
    </span>

    <button
      v-if="draft.trim() && !exactMatch"
      type="button"
      class="tag picker__new"
      @mousedown.prevent="createNew"
    >
      ＋ 新建「{{ draft.trim() }}」
    </button>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  /** 已选中的条目：[{id, name, …}]，id 为空串表示"词表里还没有、提交时由后端建" */
  modelValue: { type: Array, default: () => [] },
  /** 整个词表：[{id, name, aliases?, videoCount?}]，小几百条，前端过滤够用 */
  options: { type: Array, default: () => [] },
  placeholder: { type: String, default: '输入后回车' },
  chipClass: { type: String, default: '' },
  /** 关掉就只能从词表里选（标签的 AI 路径要这么用，人工路径不关） */
  allowCreate: { type: Boolean, default: true }
})
const emit = defineEmits(['update:modelValue', 'change'])

const draft = ref('')
const open = ref(false)
const active = ref(-1)

const norm = (s) => (s || '').trim().toLowerCase()

/** 命中正名或别名；已经选上的不再列出来 */
const matches = computed(() => {
  const q = norm(draft.value)
  const chosen = new Set(props.modelValue.map((x) => x.id))
  return props.options
    .filter((o) => !chosen.has(o.id))
    .map((o) => {
      const hit = !q || norm(o.name).includes(q) || (o.aliases || []).some((a) => norm(a).includes(q))
      if (!hit) return null
      const alias = q && norm(o.name) !== q && (o.aliases || []).some((a) => norm(a) === q)
      return { ...o, hint: alias ? `别名匹配 · ${o.videoCount ?? 0} 部` : o.videoCount ? `${o.videoCount} 部` : '' }
    })
    .filter(Boolean)
    .slice(0, 8)
})

const exactMatch = computed(() =>
  props.options.some((o) => norm(o.name) === norm(draft.value) || (o.aliases || []).some((a) => norm(a) === norm(draft.value))))

const commit = (list) => {
  emit('update:modelValue', list)
  emit('change', list)
}

const add = (item) => {
  if (!item) return
  draft.value = ''
  active.value = -1
  commit([...props.modelValue, item])
}

const pick = (item) => {
  if (item) return add({ id: item.id, name: item.name })
  if (draft.value.trim()) createNew()
}

const createNew = () => {
  if (!props.allowCreate) return
  add({ id: '', name: draft.value.trim() })
}

const removeAt = (i) => commit(props.modelValue.filter((_, idx) => idx !== i))

const move = (step) => {
  if (!matches.value.length) return
  active.value = (active.value + step + matches.value.length) % matches.value.length
}

// blur 先到、点击后到：立刻收起来就点不到候选项了
const closeSoon = () => setTimeout(() => { open.value = false }, 120)
</script>

<style scoped>
.picker {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--s1);
  min-width: 0;
}

.picker__chip {
  /* 可移除的胶囊：右侧留一个 × 的位置，其余外观跟全局 .tag 一致 */
  padding-right: 2px;
}

.picker__x {
  border: 0;
  background: none;
  color: inherit;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  padding: 0 3px;
  opacity: .6;
}

.picker__x:hover { opacity: 1; }

.picker__input-wrap {
  position: relative;
  display: inline-flex;
}

.picker__input {
  width: 168px;
  height: var(--ctl-h-xs);
  font-size: var(--f-xs);
}

.picker__list {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  z-index: 20;
  min-width: 100%;
  margin: 0;
  padding: var(--s1) 0;
  list-style: none;
  background: var(--bg-elev);
  border: 1px solid var(--border);
  border-radius: var(--r2);
  box-shadow: var(--shadow-1);
}

.picker__list li {
  display: flex;
  justify-content: space-between;
  gap: var(--s3);
  padding: 3px var(--s3);
  font-size: var(--f-xs);
  white-space: nowrap;
  cursor: pointer;
}

.picker__list li.is-active,
.picker__list li:hover {
  background: var(--bg-elev-2);
  color: var(--accent);
}

.picker__hint {
  color: var(--text-faint);
}

.picker__new {
  color: var(--accent);
  border-color: var(--border);
  cursor: pointer;
}
</style>
