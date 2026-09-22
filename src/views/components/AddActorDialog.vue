<template>
  <Dialog
    :visible="visible"
    :title="isEdit ? '编辑演员' : '添加演员'"
    size="sm"
    @confirm="handleSave"
    @cancel="handleCancel"
  >
    <template #content>
      <div class="form">
        <div class="field">
          <label for="aa-name">姓名 <span class="req">*</span></label>
          <input
            id="aa-name"
            v-model="form.name"
            class="input"
            type="text"
            placeholder="演员姓名"
            maxlength="50"
          />
        </div>

        <div class="field">
          <label for="aa-alias">别名</label>
          <input
            id="aa-alias"
            v-model="form.alias"
            class="input"
            type="text"
            placeholder="别名（选填）"
            maxlength="50"
          />
        </div>

        <!-- 地区：既能在已有值里搜，也能手填一个新值 -->
        <label class="field">
          <span class="field__label">地区</span>
          <ComboBox
            v-if="!customCountry"
            v-model="form.country"
            :options="countryOptions"
            placeholder="选择或输入地区"
            all-label="（无地区）"
          />
          <input
            v-else
            v-model="form.country"
            class="input"
            type="text"
            placeholder="输入新的地区"
            maxlength="20"
          />
          <button type="button" class="switch" @click="customCountry = !customCountry">
            {{ customCountry ? '从已有地区中选择' : '填写新的地区' }}
          </button>
        </label>

        <div class="field">
          <label for="aa-bio">简介</label>
          <textarea
            id="aa-bio"
            v-model="form.bio"
            class="textarea"
            rows="4"
            placeholder="简介（选填）"
          ></textarea>
        </div>
      </div>
    </template>

    <template #extra-actions>
      <button
        v-if="isEdit"
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
import { actorApi } from '@/scripts/api'
import { useUiStore } from '@/scripts/store/ui'
import Dialog from './Dialog.vue'
import ComboBox from './ComboBox.vue'

const props = defineProps({
  visible: Boolean,
  editingActor: Object
})

const emit = defineEmits(['save', 'cancel', 'delete'])

const ui = useUiStore()

const countries = ref([])
const customCountry = ref(false)

const form = ref({
  id: '',
  name: '',
  alias: '',
  country: '',
  bio: ''
})

const isEdit = computed(() => !!props.editingActor)

// 国家是字符串字段，直接拿值本身当选项 id
const countryOptions = computed(() => countries.value.map((c) => ({ id: c, name: c })))

// 专用去重接口：列表接口已把 pageSize 钳到 500，靠翻列表取地区会静默截断
const loadCountries = async () => {
  try {
    const res = await actorApi.getCountries()
    countries.value = res.success && Array.isArray(res.data) ? res.data : []
  } catch (e) {
    console.error('加载地区列表失败', e)
  }
}

watch(() => props.visible, (val) => {
  if (!val) return
  customCountry.value = false
  loadCountries()
  const source = props.editingActor
  form.value = source
    ? {
        id: source.id || '',
        name: source.name || '',
        alias: source.alias || '',
        country: source.country || '',
        bio: source.bio || ''
      }
    : { id: '', name: '', alias: '', country: '', bio: '' }
})

const handleSave = () => {
  if (!form.value.name.trim()) {
    ui.warn('请输入演员姓名')
    return
  }
  emit('save', { ...form.value })
}

const handleCancel = () => {
  emit('cancel')
}

// 删除确认由父页面统一处理（ActorList / ActorDetail 各自 await ui.confirm），
// 这里再问一次会出现两个一模一样的对话框，跟 AddVideoDialog 的做法保持一致
const handleDelete = () => {
  emit('delete', props.editingActor.id)
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
