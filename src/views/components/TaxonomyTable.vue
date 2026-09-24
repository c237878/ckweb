<template>
  <div class="tax">
    <div class="tax__head">
      <h3 class="tax__title">{{ label }}</h3>
      <span class="hint">{{ hint }}</span>
    </div>

    <div class="table-wrap">
      <table class="table">
        <caption class="sr-only">{{ label }}可选值管理表，共 {{ rows.length }} 项</caption>
        <thead>
          <tr>
            <th>可选值</th>
            <th class="col-usage">被使用</th>
            <th class="col-order">顺序</th>
            <th class="col-ops">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, i) in rows" :key="row.value">
            <td class="cell-value">
              <input
                v-if="editing === row.value"
                ref="editInput"
                v-model.trim="editDraft"
                class="input"
                type="text"
                maxlength="20"
                :aria-label="`输入新的${label}名`"
                @keyup.enter="rename(row)"
                @keyup.esc="cancelRename"
              />
              <span v-else>{{ row.value }}</span>
            </td>
            <td class="col-usage">
              <span v-if="row.total" class="tag" :title="usageText(row)">{{ row.total }}</span>
              <span v-else class="tag tag--muted">未使用</span>
            </td>
            <td class="col-order">
              <div class="cell-btns">
                <button
                  class="btn btn--sm btn--ghost"
                  :disabled="busy || !!editing || i === 0"
                  :aria-label="`上移 ${row.value}`"
                  @click="move(i, -1)"
                >
↑
</button>
                <button
                  class="btn btn--sm btn--ghost"
                  :disabled="busy || !!editing || i === rows.length - 1"
                  :aria-label="`下移 ${row.value}`"
                  @click="move(i, 1)"
                >
↓
</button>
              </div>
            </td>
            <td class="col-ops">
              <div v-if="editing === row.value" class="cell-btns">
                <button class="btn btn--sm btn--primary" :disabled="busy || !editDraft" @click="rename(row)">确定</button>
                <button class="btn btn--sm" :disabled="busy" @click="cancelRename">取消</button>
              </div>
              <div v-else class="cell-btns">
                <button class="btn btn--sm" :disabled="busy || !!editing" @click="startRename(row)">改名</button>
                <button class="btn btn--sm btn--danger" :disabled="busy || !!editing" @click="remove(row)">删除</button>
              </div>
            </td>
          </tr>
          <tr v-if="!rows.length">
            <td colspan="4" class="cell-empty">还没有可选值，用下面的输入框添加。</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 清单外仍在使用的值不列出来，就永远解释不了"为什么下拉框里少一项" -->
    <div v-if="orphans.length" class="tax__orphans">
      <p class="hint">这些值还有记录在用，但不在可选清单里，所以各页面的下拉框选不到：</p>
      <div class="pills">
        <button
          v-for="o in orphans"
          :key="o.value"
          class="tag tag--warn pill"
          :disabled="busy || !!editing"
          :title="`${usageText(o)}，点击加入清单`"
          @click="adopt(o)"
        >
{{ o.value }}
</button>
      </div>
    </div>

    <div class="tax__add">
      <input
        v-model.trim="draft"
        class="input"
        type="text"
        maxlength="20"
        :placeholder="placeholder"
        :aria-label="`新增${label}`"
        @keyup.enter="add"
      />
      <button class="btn btn--sm" :disabled="busy || !!editing || !draft" @click="add">添加</button>
    </div>
  </div>
</template>

<script setup>
import { nextTick, ref } from 'vue'
import { taxonomyApi } from '@/scripts/api'
import { useUiStore, errText } from '@/scripts/store/ui'

const props = defineProps({
  /** countries | categories，与后端 system_settings 的键同名 */
  kind: { type: String, required: true },
  label: { type: String, required: true },
  rows: { type: Array, default: () => [] },
  orphans: { type: Array, default: () => [] },
  hint: { type: String, default: '' },
  placeholder: { type: String, default: '输入后回车添加' }
})

const emit = defineEmits(['saved'])

const ui = useUiStore()
const busy = ref(false)
const draft = ref('')
const editing = ref('')
const editDraft = ref('')
const editInput = ref([])

const values = () => props.rows.map((r) => r.value)

/** 分类只落在影片上，地区还落在系列与演员上 */
const usageText = (row) => {
  const parts = [`影片 ${row.videos}`]
  if (props.kind === 'countries') parts.push(`系列 ${row.series}`, `演员 ${row.actors}`)
  return parts.join(' · ')
}

const exists = (value) => props.rows.some((r) => r.value === value) || props.orphans.some((o) => o.value === value)

/** 每次操作都立即落库：清单是逗号串，没有"半改状态"可留 */
const post = async (items, renames = []) => {
  if (busy.value) return false
  busy.value = true
  try {
    const res = await taxonomyApi.save({ kind: props.kind, items, renames })
    if (res?.success) {
      emit('saved')
      return true
    }
    ui.error(errText(res, '保存失败'))
  } catch (error) {
    console.error('保存数据源失败:', error)
    ui.error('保存失败：' + errText(error))
  } finally {
    busy.value = false
  }
  return false
}

const startRename = async (row) => {
  editing.value = row.value
  editDraft.value = row.value
  await nextTick()
  editInput.value[0]?.focus()
}

const cancelRename = () => {
  editing.value = ''
  editDraft.value = ''
}

const rename = async (row) => {
  const to = editDraft.value
  if (!to) return
  if (to === row.value) return cancelRename()
  if (exists(to)) {
    ui.warn(`「${to}」已经存在`)
    return
  }

  if (row.total > 0) {
    const go = await ui.confirm({
      title: '改名并更新已使用的记录',
      message: `「${row.value}」正在被 ${row.total} 条记录使用（${usageText(row)}）。`
        + `改成「${to}」会同时把这些记录改成新值，改完清单与数据里都只剩「${to}」。`,
      confirmLabel: '改名并更新记录'
    })
    if (!go) return
  }

  const items = values().map((v) => (v === row.value ? to : v))
  if (await post(items, [{ from: row.value, to }])) {
    cancelRename()
    ui.success(row.total > 0 ? `已改名，并更新了 ${row.total} 条记录` : '已改名')
  }
}

const remove = async (row) => {
  const go = await ui.confirm({
    title: '从可选值中删除',
    message: row.total > 0
      ? `「${row.value}」还有 ${row.total} 条记录在用（${usageText(row)}）。`
        + '删除只会把它从可选值里去掉，这些记录保持原值不变，但各页面的下拉框里不会再出现它。'
      : `把「${row.value}」从可选值里删掉？没有记录在用，删除不影响任何数据。`,
    danger: row.total > 0,
    confirmLabel: '删除'
  })
  if (!go) return
  if (await post(values().filter((v) => v !== row.value))) ui.success('已删除')
}

const move = async (index, dir) => {
  const items = values()
  const j = index + dir
  ;[items[index], items[j]] = [items[j], items[index]]
  await post(items)
}

const add = async () => {
  const value = draft.value
  if (!value) return
  if (exists(value)) {
    ui.warn(`「${value}」已经存在`)
    return
  }
  if (await post([...values(), value])) {
    draft.value = ''
    ui.success('已添加')
  }
}

/** 收编清单外的值：只是把它加回可选清单，不动任何记录 */
const adopt = async (orphan) => {
  if (await post([...values(), orphan.value])) ui.success(`「${orphan.value}」已加入可选值`)
}
</script>

<style scoped>
.tax {
  display: flex;
  flex-direction: column;
  gap: var(--s2);
  min-width: 0;
}

.tax__head {
  display: flex;
  align-items: baseline;
  gap: var(--s3);
  flex-wrap: wrap;
}

.tax__title {
  font-size: var(--f-lg);
  font-weight: 600;
}

.hint {
  font-size: var(--f-xs);
  color: var(--text-dim);
}

/* 表格列宽：值列吃掉剩余空间，其余按内容收 */
.col-usage {
  width: 88px;
}

.col-order {
  width: 84px;
}

.col-ops {
  width: 148px;
}

/* td 自己保持 table-cell，按钮组用内层 div 排 */
.cell-btns {
  display: flex;
  align-items: center;
  gap: var(--s1);
}

.cell-value {
  min-width: 120px;
}

.cell-empty {
  color: var(--text-faint);
  font-size: var(--f-sm);
}

.tax__orphans {
  display: flex;
  flex-direction: column;
  gap: var(--s2);
  padding: var(--s3);
  border: 1px dashed var(--border-strong);
  border-radius: var(--r1);
}

.pill {
  max-width: 100%;
  cursor: pointer;
}

.pill:disabled {
  cursor: not-allowed;
}

.tax__add {
  display: flex;
  align-items: center;
  gap: var(--s2);
  max-width: 360px;
}

.tax__add .input {
  flex: 1;
  min-width: 0;
}
</style>
