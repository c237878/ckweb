<template>
  <div class="combobox dropdown" ref="root">
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

    <ul v-if="open" ref="menuEl" class="dropdown-menu" role="listbox">
      <li
        v-if="allLabel"
        class="dropdown-option"
        :class="{ active: !modelValue, 'is-hl': highlight === -1 }"
        role="option"
        :aria-selected="!modelValue"
        @mousedown.prevent="choose(null)"
      >
{{ allLabel }}
</li>
      <li
        v-for="(row, i) in visible"
        :key="row.opt.id"
        class="dropdown-option"
        :class="{ active: row.opt.id === modelValue, 'is-hl': highlight === i }"
        role="option"
        :aria-selected="row.opt.id === modelValue"
        @mousedown.prevent="choose(row.opt)"
        @mouseenter="highlight = i"
      >
{{ row.opt.name }}<span v-if="row.alias" class="combo-alias">曾用名 {{ row.alias }}</span>
</li>
      <li v-if="visible.length === 0" class="dropdown-empty">无匹配项</li>
    </ul>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onUnmounted } from 'vue'
import { autoFitDropdown } from '@/scripts/utils/dropdownFit'
import { debounce } from '@/scripts/utils/debounce'

const props = defineProps({
  modelValue: { type: String, default: '' },
  /** [{ id, name }] */
  options: { type: Array, default: () => [] },
  placeholder: { type: String, default: '搜索...' },
  /** 顶部"全部 xxx"项的文案，传空串则不显示 */
  allLabel: { type: String, default: '全部' },
  /** 下拉最多渲染多少条，避免 700+ 系列一次性铺满 DOM */
  limit: { type: Number, default: 50 },
  /**
   * 本地这份选项搜不到时的兜底查询：`(关键字) => Promise<[{ id, name, alias? }|{ aliases? }]>`。
   *
   * 为什么要有这一档：系列别名有 675 条，全塞进 /api/video/meta 会让那个接口从 59KB 涨到 94KB
   * （gzip +14.6KB），而它是影片列表页每次进来都要拉的——为了一个搜索框把列表页载荷加四成不划算。
   * 所以词表接口本来就会搜别名（/api/series 的 keyword 同时打 name 与 alias），
   * 这里只在**本地一条都没命中**时发一次请求：输中文名不发请求，输日文原名才发。
   */
  remote: { type: Function, default: null }
})

const emit = defineEmits(['update:modelValue', 'change'])

const open = ref(false)
const text = ref('')
const highlight = ref(-1)
const inputEl = ref(null)
const root = ref(null)
const menuEl = ref(null)
// 面板展开期间的自适应跟随，收起时要把监听摘掉
let stopFit = null

watch(open, (expanded) => {
  if (!expanded) {
    stopFit?.()
    stopFit = null
    return
  }
  nextTick(() => {
    stopFit?.()
    stopFit = autoFitDropdown(menuEl.value, root.value)
  })
})

onUnmounted(() => stopFit?.())

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

/**
 * 候选：名字与别名都能搜到，口径与演员检索一致——
 * 先给整串相等的一批，一批都没有才退到"包含"。
 * 逐行判会把精确和模糊混在同一列里，打全名也照样拖出一串，所以分档在整个候选集上做。
 * 命中的是别名时把别名带在行上，免得看到"唾液混合"却不知道自己为什么搜到了它。
 */
const sameName = (value, keyword) => (value || '').trim().toLowerCase() === keyword
const hasName = (value, keyword) => (value || '').toLowerCase().includes(keyword)

/** 系列存的是单个 alias 字符串，片商是 aliases 数组，两种形状在这儿合流 */
const aliasesOf = (opt) => [...(opt.aliases || []), opt.alias].filter((x) => typeof x === 'string' && x)

const matchRows = (options, kw) => {
  const exact = []
  const fuzzy = []
  for (const opt of options) {
    const aliases = aliasesOf(opt)
    const aExact = aliases.find((a) => sameName(a, kw))
    if (sameName(opt.name, kw) || aExact) {
      exact.push({ opt, alias: sameName(opt.name, kw) ? '' : aExact })
      continue
    }
    const aFuzzy = aliases.find((a) => hasName(a, kw))
    if (hasName(opt.name, kw) || aFuzzy) fuzzy.push({ opt, alias: hasName(opt.name, kw) ? '' : aFuzzy })
  }
  return exact.length ? exact : fuzzy
}

const localRows = (kw) =>
  kw ? matchRows(props.options, kw) : props.options.map((opt) => ({ opt, alias: '' }))

// 服务端兜底那批候选。seq 是防止慢请求的旧结果盖掉新输入
const remoteRows = ref([])
let seq = 0

const fetchRemote = debounce(async () => {
  const kw = text.value.trim().toLowerCase()
  if (!props.remote || !kw || localRows(kw).length) {
    remoteRows.value = []
    return
  }
  const mine = ++seq
  try {
    const rows = await props.remote(kw)
    if (mine !== seq) return
    // 服务端回来的这批也走同一档口径，免得远端结果绕过"精确优先"
    remoteRows.value = matchRows(rows || [], kw)
  } catch {
    if (mine === seq) remoteRows.value = []
  }
}, 250)

watch(text, () => { fetchRemote() })

const visible = computed(() => {
  const kw = text.value.trim().toLowerCase()
  const rows = localRows(kw)
  // 本地有命中就用本地的，一次请求都不发；只有全空才让远端那批顶上
  if (kw && !rows.length && props.remote) return remoteRows.value.slice(0, props.limit)
  return rows.slice(0, props.limit)
})

watch(visible, () => { highlight.value = -1 })

const onInput = (event) => {
  typing = true
  text.value = event.target.value
  open.value = true
  // 先记下"进来时是不是已经选中了一项"：emit 之后 props 要到下一轮才变，不能接着读
  const had = props.modelValue
  // 开始改关键字就先取消已选中的项，避免"看着是搜索 NTR、实际还在按旧系列过滤"
  if (had) emit('update:modelValue', '')
  // 改成空串等于"我要全部"，这一档必须连 change 一起发出去：
  // 只发 update:modelValue 的话框里空了、列表却还停在旧筛选的那几页（实测就是这样）
  if (had && !text.value) emit('change', '')
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
  const row = visible.value[index]
  if (row) choose(row.opt)
}

const clear = () => choose(null)

const onBlur = () => {
  // 用 nextTick 让 mousedown.prevent 的选项点击先完成
  nextTick(() => { open.value = false })
}
</script>

<style scoped>
.combobox .input {
  padding-right: 26px;
}

/* 命中来自别名时把别名显示出来：不然"唾液混合"这种结果看不出为什么被搜到 */
.combo-alias {
  margin-left: var(--s2);
  color: var(--text-faint);
  font-size: var(--f-xs);
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

</style>
