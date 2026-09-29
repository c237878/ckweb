<template>
  <Dialog
    :visible="visible"
    title="加一版"
    size="sm"
    @cancel="$emit('cancel')"
  >
    <!-- 自定义底部按钮：Dialog 的内置契约是"点确认即关闭"，而这里校验不通过（没选类型、
         文件名标识撞车）要留在弹窗里改，所以不走内置 actions -->
    <template #actions>
      <button type="button" class="btn" @click="$emit('cancel')">取消</button>
      <button type="button" class="btn btn--primary" :disabled="saving || !form.typeId" @click="save">
        {{ saving ? '保存中…' : '保存' }}
      </button>
    </template>
    <template #content>
      <!-- 一部片名下的每一份文件各一行（v11）。这里只登记"有这一版"，
           文件从哪儿来（上传 / 找回 / 手填路径）在保存之后用详情页那几颗按钮处理 -->
      <fieldset class="form-shell">
        <div class="form">
          <div class="field">
            <label for="avv-type">版本类型 <span class="req">*</span></label>
            <SelectList
              v-model="form.typeId"
              :options="typeOptions"
              label="选择版本类型"
              placeholder="选这一版是谁做的 / 什么性质"
            />
          </div>

          <div class="field">
            <label for="avv-label">版本名称</label>
            <input
              id="avv-label"
              v-model="form.label"
              class="input"
              type="text"
              placeholder="留空就显示类型名，如「湿姐」"
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
  /** 已有的版本行，用来提醒会撞名 */
  versions: { type: Array, default: () => [] }
})
const emit = defineEmits(['saved', 'cancel', 'error'])

const types = ref([])
const saving = ref(false)
const form = reactive({ typeId: '', label: '', code: '', filePath: '' })

const typeOptions = computed(() => types.value.map((t) => ({
  value: t.id,
  label: t.suffix ? `${t.name}（尾巴 ${t.suffix}）` : t.name
})))

const suffix = computed(() => types.value.find((t) => t.id === form.typeId)?.suffix || '')
const suggestedCode = computed(() => `${props.video.code || ''}${suffix.value}` || '（先填番号或类型后缀）')

// 词表读一次就够：设置里改了类型要重开这个弹窗才拿得到新的一份
watch(() => props.visible, async (v) => {
  if (!v) return
  form.typeId = ''
  form.label = ''
  form.code = ''
  form.filePath = ''
  try {
    const res = await videoApi.getVersionTypes()
    if (res?.success) types.value = res.data || []
  } catch (error) {
    console.error('加载版本类型失败:', error)
  }
})

const save = async () => {
  if (!form.typeId) return
  saving.value = true
  try {
    const code = form.code.trim() || suggestedCode.value
    if (props.versions.some((v) => v.code === code)) {
      // 行级番号是"文件名该长什么样"的权威值，撞车了改名会互相覆盖，这里先挡住
      saving.value = false
      emit('error', `文件名标识「${code}」已经被${props.versions.find((v) => v.code === code)?.displayName || '别的版本'}占着`)
      return
    }
    const res = await videoApi.addVersion({
      videoId: props.video.id,
      typeId: form.typeId,
      label: form.label.trim(),
      code,
      filePath: form.filePath.trim()
    })
    if (!res?.success) {
      // 失败留在弹窗里：报错文案会指出该改哪一格，关掉重开就把刚填的丢了
      emit('error', errText(res, '添加失败'))
      return
    }
    emit('saved', res.data)
  } catch (error) {
    console.error('添加版本失败:', error)
    emit('error', errText(error, '添加失败'))
  } finally {
    saving.value = false
  }
}
</script>
