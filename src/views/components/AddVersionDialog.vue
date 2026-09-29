<template>
  <Dialog
    :visible="visible"
    :title="isEdit ? '改这版' : '加一版'"
    size="sm"
    @cancel="$emit('cancel')"
  >
    <!-- 自定义底部按钮：Dialog 的内置契约是"点确认即关闭"，而这里校验不通过（没选类型、
         文件名标识撞车）要留在弹窗里改，所以不走内置 actions -->
    <template #actions>
      <button type="button" class="btn" @click="$emit('cancel')">取消</button>
      <button type="button" class="btn btn--primary" :disabled="saving || needType" @click="save">
        {{ saving ? '保存中…' : '保存' }}
      </button>
    </template>
    <template #content>
      <!-- 一部片名下的每一份文件各一行（v11）。这里只管库里那一行写成了什么，
           盘上的文件名不会跟着变 —— 改过文件名标识后要不要顺带改名，由父级问一次再走 align-name -->
      <fieldset class="form-shell">
        <div class="form">
          <div class="field">
            <!-- 原版那一行没有类型（type_id 固定空串），所以既不该必填也不该让人去给它挑一个类型：
                 硬要求选类型会让"改原版的文件名标识"根本保存不了 -->
            <template v-if="isOriginal">
              <label for="avv-type">版本类型</label>
              <span class="tag tag--muted">原版（不属于任何类型）</span>
            </template>
            <template v-else>
              <label for="avv-type">版本类型 <span class="req">*</span></label>
              <SelectList
                v-model="form.typeId"
                :options="typeOptions"
                label="选择版本类型"
                placeholder="选这一版是谁做的 / 什么性质"
              />
            </template>
          </div>

          <div class="field">
            <label for="avv-label">版本名称</label>
            <input
              id="avv-label"
              v-model="form.label"
              class="input"
              type="text"
              :placeholder="isOriginal ? '留空显示「原版」' : '留空就显示类型名，如「湿姐」'"
            />
          </div>

          <div class="field">
            <label for="avv-code">文件名标识</label>
            <input
              id="avv-code"
              v-model="form.code"
              class="input"
              type="text"
              :placeholder="`留空自动用 ${suggestedCode}`"
            />
            <!-- 改这版时把"盘上现在叫什么"摆出来：不摆的话人会以为保存完文件名就跟着变了 -->
            <p v-if="isEdit" class="hint">
              盘上现在叫 {{ diskName || '（这一版还没有文件）' }}，保存只改库里的标识
            </p>
          </div>

          <div class="field">
            <label for="avv-path">文件路径</label>
            <input
              id="avv-path"
              v-model="form.filePath"
              class="input"
              type="text"
              placeholder="留空表示还没上传，之后点「重置」按文件名标识自动找回"
            />
          </div>
        </div>
      </fieldset>
    </template>
  </Dialog>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import Dialog from '@/views/components/Dialog.vue'
import SelectList from '@/views/components/SelectList.vue'
import { videoApi } from '@/scripts/api'
import { errText } from '@/scripts/store/ui'

const props = defineProps({
  visible: { type: Boolean, default: false },
  /** 影片对象：番号用来建议文件名标识 */
  video: { type: Object, default: () => ({}) },
  /** 已有的版本行：撞名要当场看出来（自己那一行不算撞） */
  versions: { type: Array, default: () => [] },
  /** 传了就是改这一版，不传就是加一版 */
  version: { type: Object, default: null }
})
const emit = defineEmits(['saved', 'cancel', 'error'])

const isEdit = computed(() => !!props.version)
// 原版行：type_id 是空串，这是它的身份而不是"没填"
const isOriginal = computed(() => isEdit.value && !props.version?.typeId)
// 只有加一版（以及给非原版行改类型）才要求选类型
const needType = computed(() => !isOriginal.value && !form.typeId)

const types = ref([])
const saving = ref(false)
const form = reactive({ typeId: '', label: '', code: '', filePath: '' })
// 打开时记住原始标识：判断"标识改了没有"要拿刚打开那一刻的值比，
// 不能拿 props.version 比——父级保存后会重新拉版本清单、换掉那些对象
const openedAsEdit = ref(false)
const openedCode = ref('')

const typeOptions = computed(() => types.value.map((t) => ({
  value: t.id,
  label: t.suffix ? `${t.name}（尾巴 ${t.suffix}）` : t.name
})))

const suffix = computed(() => types.value.find((t) => t.id === form.typeId)?.suffix || '')
const suggestedCode = computed(() => `${props.video.code || ''}${suffix.value}` || '（先填番号或类型后缀）')

// 盘上那个文件的实际名字（路径最后一段），用来提醒"库里改了盘上没改"
const diskName = computed(() => {
  const p = props.version?.filePath || ''
  return p ? p.split('/').pop() : ''
})

// 打开时回填：加一版是空表，改这版把这行现在的值摆上去。
// 词表每次打开都重读一遍，设置里刚改过类型不至于还要重开页面才生效。
watch(() => props.visible, async (v) => {
  if (!v) return
  openedAsEdit.value = !!props.version
  openedCode.value = props.version?.code || ''
  form.typeId = props.version?.typeId || ''
  form.label = props.version?.label || ''
  form.code = props.version?.code || ''
  form.filePath = props.version?.filePath || ''
  try {
    const res = await videoApi.getVersionTypes()
    if (res?.success) types.value = res.data || []
  } catch (error) {
    console.error('加载版本类型失败:', error)
  }
})

const save = async () => {
  if (needType.value) return
  saving.value = true
  try {
    const code = form.code.trim() || suggestedCode.value
    const clash = props.versions.find((x) => x.code === code && x.id !== props.version?.id)
    if (clash) {
      // 行级番号是"文件名该长什么样"的权威值，两行撞同一个名字，之后改名会互相覆盖
      emit('error', `文件名标识「${code}」已经被${clash.displayName || '别的版本'}占着`)
      return
    }
    const body = {
      label: form.label.trim(),
      code,
      filePath: form.filePath.trim()
    }
    // 原版的类型留空，别把空串当成"选了某个类型"写回去
    if (!isOriginal.value) body.typeId = form.typeId
    const res = isEdit.value
      ? await videoApi.updateVersion(props.version.id, body)
      : await videoApi.addVersion({ videoId: props.video.id, ...body })
    if (!res?.success) {
      // 失败留在弹窗里：报错文案会指出该改哪一格，关掉重开就把刚填的丢了
      emit('error', errText(res, isEdit.value ? '保存失败' : '添加失败'))
      return
    }
    emit('saved', { version: res.data, isEdit: openedAsEdit.value, codeChanged: openedAsEdit.value && openedCode.value !== code })
  } catch (error) {
    console.error(isEdit.value ? '保存版本失败:' : '添加版本失败:', error)
    emit('error', errText(error, isEdit.value ? '保存失败' : '添加失败'))
  } finally {
    saving.value = false
  }
}
</script>
