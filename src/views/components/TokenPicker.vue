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

    <!-- 控件本体单独一层 .dropdown：浮层要贴着输入框翻，不能被上面那排胶囊顶偏 -->
    <span ref="ctlEl" class="picker__ctl dropdown">
      <input
        v-model="draft"
        class="input"
        type="text"
        role="combobox"
        aria-autocomplete="list"
        :placeholder="placeholder"
        :aria-expanded="open ? 'true' : 'false'"
        autocomplete="off"
        @focus="open = true"
        @input="open = true"
        @keydown.down.prevent="move(1)"
        @keydown.up.prevent="move(-1)"
        @keydown.enter.prevent="pick(active >= 0 ? matches[active] : null)"
        @keydown.esc="open = false"
        @blur="onBlur"
      />
      <!-- 自己画下拉而不是用 datalist：浏览器给 datalist 弹的是系统浅色面板，暗色主题下像另一个网站 -->
      <ul v-if="open" ref="menuEl" class="dropdown-menu" role="listbox">
        <li
          v-for="(m, i) in matches"
          :key="m.id"
          class="dropdown-option"
          :class="{ 'is-hl': i === active }"
          role="option"
          :aria-selected="i === active"
          @mousedown.prevent="pick(m)"
          @mouseenter="active = i"
        >
{{ m.name }}
          <span v-if="m.hint" class="picker__hint">{{ m.hint }}</span>
        </li>
        <li v-if="!matches.length" class="dropdown-empty">
{{ draft.trim() ? (allowCreate ? '回车新建，或换个关键词' : '词表里没有这个词') : '词表是空的' }}
        </li>
      </ul>
    </span>

    <button
      v-if="allowCreate && draft.trim() && !exactMatch"
      type="button"
      class="tag picker__new"
      @mousedown.prevent="createNew"
    >
      ＋ 新建「{{ draft.trim() }}」
    </button>
  </div>
</template>

<script setup>
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { autoFitDropdown } from '@/scripts/utils/dropdownFit'

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
const ctlEl = ref(null)
const menuEl = ref(null)

// 面板会被 .dialog__body / .info-grid 的滚动容器裁掉，和 ComboBox 用同一套自适应
let stopFit = null

watch(open, (expanded) => {
  if (!expanded) {
    stopFit?.()
    stopFit = null
    return
  }
  nextTick(() => {
    stopFit?.()
    stopFit = autoFitDropdown(menuEl.value, ctlEl.value)
  })
})

onUnmounted(() => stopFit?.())

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

watch(matches, () => { active.value = -1 })

const onBlur = () => {
  // 用 nextTick 让 mousedown.prevent 的选项点击先完成，否则点了也选不上
  nextTick(() => { open.value = false })
}
</script>

<style scoped>
.picker {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--s1);
  min-width: 0;
}

.picker__ctl {
  flex: 1;
  min-width: 168px;
}

.picker__chip {
  /* 可移除的胶囊：右侧留一个 × 的位置，其余外观跟全局 .tag 一致 */
  gap: var(--s1);
  padding-right: var(--ctl-pad-x-xs);
}

.picker__x {
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
}

.picker__x:hover {
  opacity: 1;
  background: var(--bg-hover);
}

/* 选项行右端那一点补充信息（几部片 / 别名匹配），走 .meta 的次要文本口径 */
.picker__hint {
  margin-left: auto;
  font-size: var(--f-xs);
  color: var(--text-faint);
}

.picker__new {
  color: var(--accent);
  cursor: pointer;
}
</style>
