<template>
  <div class="type-lists" :class="embedded ? 'type-lists--embedded' : 'page'">
    <h1 v-if="!embedded" class="page-title">版本类型</h1>

    <div class="filters">
      <button class="btn btn--sm btn--primary" @click="open(null)">添加类型</button>
    </div>

    <!-- 一部片同一个类型只能有一条，所以第二版必然落到别的类型上；
         而那一版的文件名标识是按「影片番号 + 该类型尾巴」自动拼的，
         几家类型共用一个尾巴时第二版一保存就撞上第一版的标识，这里当场点出来 -->
    <p v-if="dupSuffixes.length" class="notice">
      尾巴 {{ dupSuffixes.join('；') }} —— 同一部片加第二版时会自动算出重复的文件名标识，给它们各换一个字母。
    </p>

    <table class="grid-table">
      <thead>
        <tr>
          <th>类型</th><th class="num">版本数</th><th class="ops">操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(t, i) in rows" :key="t.id">
          <!-- 后缀与类型名同列：这一列的值本来就短，拆成一列在窄面板里会把操作列顶出容器 -->
          <td>
            {{ t.name }}<span v-if="t.suffix" class="dim suffix"> · 尾巴 {{ t.suffix }}</span>
          </td>
          <td class="num">{{ t.used }}</td>
          <td class="ops">
            <button
              class="btn btn--sm btn--ghost"
              :disabled="i === 0"
              title="上移一位"
              @click="move(t.id, 'up')"
            >
↑
</button>
            <button
              class="btn btn--sm btn--ghost"
              :disabled="i === rows.length - 1"
              title="下移一位"
              @click="move(t.id, 'down')"
            >
↓
</button>
            <button class="btn btn--sm btn--ghost" @click="open(t)">编辑</button>
            <button class="btn btn--sm btn--danger" @click="askDelete(t)">删除</button>
          </td>
        </tr>
      </tbody>
    </table>
    <p v-if="!rows.length" class="empty"><span>还没有版本类型</span></p>

    <Dialog
      :visible="show"
      :title="editing ? `编辑类型「${editing.name}」` : '添加版本类型'"
      size="sm"
      @confirm="save"
      @cancel="close"
    >
      <template #content>
        <div class="form">
          <div class="field">
            <label for="vt-name">类型名称 <span class="req">*</span></label>
            <input
              id="vt-name"
              v-model="form.name"
              class="input"
              type="text"
              maxlength="20"
              placeholder="如：湿姐、水果派、剪辑"
            />
          </div>
          <div class="field">
            <label for="vt-suffix">文件名后缀</label>
            <input
              id="vt-suffix"
              v-model="form.suffix"
              class="input"
              type="text"
              maxlength="8"
              placeholder="新建这一版时建议的尾巴，如 C；改番号不会重算它"
            />
          </div>
        </div>
      </template>
    </Dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import Dialog from '@/views/components/Dialog.vue'
import { versionTypeApi } from '@/scripts/api'
import { useUiStore, errText } from '@/scripts/store/ui'

defineProps({
  /** 设置页内嵌时不再画整页标题与容器类 */
  embedded: { type: Boolean, default: false }
})

const ui = useUiStore()
const rows = ref([])

// 哪些尾巴被多个类型共用（后端 Types() 带 suffixDup 出来，这里只汇成一句话）
const dupSuffixes = computed(() => {
  const dup = rows.value.filter((t) => t.suffixDup && t.suffix)
  const seen = new Set()
  return dup.reduce((acc, t) => {
    const names = rows.value.filter((o) => o.suffix === t.suffix).map((o) => o.name).join(' / ')
    if (!seen.has(t.suffix)) { seen.add(t.suffix); acc.push(`「${names}」都是 ${t.suffix}`) }
    return acc
  }, [])
})
const show = ref(false)
const editing = ref(null)
const form = ref({ name: '', suffix: '' })

const load = async () => {
  try {
    const res = await versionTypeApi.getList()
    if (res?.success) rows.value = res.data || []
    else ui.error(errText(res, '加载失败'))
  } catch (error) {
    console.error('加载版本类型失败:', error)
    ui.error('加载失败：' + errText(error))
  }
}

const open = (t) => {
  editing.value = t
  form.value = { name: t?.name || '', suffix: t?.suffix || '' }
  show.value = true
}

const close = () => {
  show.value = false
  editing.value = null
}

const save = async () => {
  const body = { name: form.value.name.trim(), suffix: form.value.suffix.trim() }
  if (!body.name) {
    ui.error('类型名称不能为空')
    return
  }
  try {
    const res = editing.value
      ? await versionTypeApi.update(editing.value.id, body)
      : await versionTypeApi.add(body)
    // 业务失败是 200 + success:false，不判就会"没存上还说已保存"
    if (!res?.success) {
      ui.error(errText(res, '保存失败'))
      return
    }
    close()
    await load()
    ui.success(res.message || '已保存')
  } catch (error) {
    console.error('保存版本类型失败:', error)
    ui.error('保存失败：' + errText(error))
  }
}

const move = async (id, dir) => {
  try {
    const res = await versionTypeApi.move(id, dir)
    if (!res?.success) return ui.error(errText(res, '移动失败'))
    await load()
  } catch (error) {
    console.error('移动失败:', error)
    ui.error('移动失败：' + errText(error))
  }
}

const askDelete = async (t) => {
  // 后端也会挡（删了那些版本就失去类型名），在这儿先说清要改哪几版，省一次无用确认
  if (t.used > 0) {
    ui.error(`还有 ${t.used} 个版本用着「${t.name}」，先把它们改成别的类型`)
    return
  }
  const go = await ui.confirm({
    title: '删除版本类型',
    message: `删除「${t.name}」。没有版本在用，删了只是这一类以后选不到。`,
    danger: true
  })
  if (!go) return
  try {
    const res = await versionTypeApi.remove(t.id)
    if (!res?.success) return ui.error(errText(res, '删除失败'))
    await load()
    ui.success(res.message || '已删除')
  } catch (error) {
    console.error('删除版本类型失败:', error)
    ui.error('删除失败：' + errText(error))
  }
}

onMounted(load)
</script>

<style scoped>
/* 尾巴跟着类型名走：次要信息，字号降一档就好，不再占一整列 */
.suffix {
  font-size: var(--f-xs);
}
</style>
