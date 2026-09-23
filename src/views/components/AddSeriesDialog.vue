<template>
  <Dialog
    :visible="visible"
    :title="editingSeries ? '编辑系列' : '添加系列'"
    size="sm"
    @confirm="handleSave"
    @cancel="handleCancel"
  >
    <template #content>
      <div class="form">
        <div class="field">
          <label for="as-name">名称 <span class="req">*</span></label>
          <input
            id="as-name"
            v-model="form.name"
            class="input"
            type="text"
            placeholder="系列名称（必填）"
            maxlength="100"
          />
        </div>

        <div class="field">
          <label for="as-alias">别名</label>
          <input
            id="as-alias"
            v-model="form.alias"
            class="input"
            type="text"
            placeholder="系列别名（可选）"
            maxlength="100"
          />
        </div>

        <!-- 地区：既能在已有值里搜，也能手填一个新值 -->
        <!-- 可选值来自系统设置的规范列表，这里只做选择；要新增取值去 设置 → 数据源 -->
        <label class="field">
          <span class="field__label">地区</span>
          <SelectList v-model="form.country" :options="countryOptions" all-label="（无地区）" label="选择地区" />
        </label>

        <div class="field">
          <label for="as-link">链接</label>
          <input
            id="as-link"
            v-model="form.link"
            class="input"
            type="url"
            placeholder="系列链接（可选）"
          />
        </div>
      </div>
    </template>

    <template #extra-actions>
      <button
        v-if="editingSeries"
        type="button"
        class="btn btn--danger btn--sm foot-left"
        @click="handleDelete"
      >
        删除
      </button>
    </template>
  </Dialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { seriesApi } from '@/scripts/api'
import { useUiStore } from '@/scripts/store/ui'
import Dialog from './Dialog.vue'
import SelectList from './SelectList.vue'
import { toOptions } from '@/scripts/utils/options'

const props = defineProps({
  visible: Boolean,
  editingSeries: Object
})

const emit = defineEmits(['save', 'cancel', 'delete'])

const ui = useUiStore()

const countries = ref([])

const form = ref({
  name: '',
  alias: '',
  country: '',
  link: ''
})

const blankForm = () => ({ name: '', alias: '', country: '', link: '' })

// 地区是字符串字段，直接拿值本身当选项 id
const countryOptions = computed(() => toOptions(countries.value, form.value.country))

// 专用去重接口：列表接口已把 pageSize 钳到 500，靠翻列表取地区会静默截断
const loadCountries = async () => {
  try {
    const res = await seriesApi.getCountries()
    countries.value = res.success && Array.isArray(res.data) ? res.data : []
  } catch (error) {
    console.error('加载地区列表失败:', error)
  }
}

watch(() => props.visible, (val) => {
  if (!val) return
  loadCountries()
  // 编辑时保留原对象携带的其余字段（如 utime），与迁移前的整体展开一致
  form.value = props.editingSeries
    ? { name: '', alias: '', country: '', link: '', ...props.editingSeries }
    : blankForm()
})

const handleSave = () => {
  if (!form.value.name) {
    ui.warn('请填写系列名称')
    return
  }
  emit('save', { ...form.value })
}

const handleCancel = () => {
  form.value = blankForm()
  emit('cancel')
}

// 删除确认由父页面统一处理（SeriesList / SeriesDetail 各自 await ui.confirm），
// 这里再问一次会出现两个一模一样的对话框，跟 AddVideoDialog 的做法保持一致
const handleDelete = () => {
  emit('delete', props.editingSeries.id)
}
</script>

<style scoped>
.form {
  display: flex;
  flex-direction: column;
  gap: var(--s4);
}

/* 包着控件的 label 用 span 当题注，外观和 .field > label 对齐 */
.field > .field__label {
  font-size: var(--f-sm);
  color: var(--text-dim);
}

.req {
  color: var(--danger);
}

.switch {
  align-self: flex-start;
  font-size: var(--f-xs);
  color: var(--accent);
}

.switch:hover {
  text-decoration: underline;
}

.foot-left {
  margin-right: auto;
}
</style>
