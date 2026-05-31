<template>
  <Dialog :visible="visible" :title="editingActor ? '编辑演员' : '添加演员'" @confirm="handleSave" @cancel="handleCancel">
    <template #content>
      <div class="form-item">
        <label>姓名 *</label>
        <input v-model="form.name" type="text" placeholder="演员姓名（必填）" />
      </div>
      <div class="form-item">
        <label>别名</label>
        <input v-model="form.alias" type="text" placeholder="别名或艺名（可选）" />
      </div>
      <div class="form-item">
        <label>类型</label>
        <div class="input-with-suggestions">
          <input 
            v-model="form.country" 
            type="text" 
            placeholder="选择或输入类型"
            @input="filterCountries"
            @focus="showCountrySuggestions = true"
            @blur="hideCountrySuggestions"
          />
          <div v-if="showCountrySuggestions && filteredCountries.length > 0" class="suggestions">
            <div 
              v-for="country in filteredCountries" 
              :key="country" 
              class="suggestion-item"
              @mousedown="selectCountry(country)"
            >
              {{ country }}
            </div>
          </div>
        </div>
      </div>
    </template>
    <template #actions>
      <button v-if="editingActor" class="delete-btn" @click="handleDelete">删除</button>
    </template>
  </Dialog>
</template>

<script setup>
import { ref, watch, defineProps, defineEmits, onMounted } from 'vue'
import { actorApi } from '@/scripts/api'
import Dialog from './Dialog.vue'

const props = defineProps({
  visible: Boolean,
  editingActor: Object
})

const emit = defineEmits(['save', 'cancel', 'delete'])

const existingCountries = ref([])
const filteredCountries = ref([])
const showCountrySuggestions = ref(false)

const form = ref({
  name: '',
  alias: '',
  country: ''
})

onMounted(async () => {
  await loadExistingCountries()
})

watch(() => props.visible, async (newVal) => {
  if (newVal) {
    await loadExistingCountries()
    if (props.editingActor) {
      form.value = { ...props.editingActor }
    } else {
      resetForm()
    }
  }
})

const loadExistingCountries = async () => {
  try {
    const res = await actorApi.getList({ page: 1, pageSize: 1000 })
    if (res.success && res.data) {
      const countries = new Set()
      res.data.forEach(actor => {
        if (actor.country) countries.add(actor.country)
      })
      existingCountries.value = Array.from(countries)
      filteredCountries.value = existingCountries.value
    }
  } catch (error) {
    console.error('加载类型列表失败:', error)
  }
}

const filterCountries = () => {
  if (!form.value.country) {
    filteredCountries.value = existingCountries.value
  } else {
    filteredCountries.value = existingCountries.value.filter(c => 
      c.toLowerCase().includes(form.value.country.toLowerCase())
    )
  }
}

const selectCountry = (country) => {
  form.value.country = country
  showCountrySuggestions.value = false
}

const hideCountrySuggestions = () => {
  setTimeout(() => {
    showCountrySuggestions.value = false
  }, 200)
}

const resetForm = () => {
  form.value = {
    name: '',
    alias: '',
    country: ''
  }
}

const handleSave = () => {
  if (!form.value.name) {
    alert('请填写演员姓名')
    return
  }
  emit('save', { ...form.value })
}

const handleCancel = () => {
  resetForm()
  emit('cancel')
}

const handleDelete = () => {
  if (confirm('确定要删除这个演员吗？此操作不可恢复！')) {
    emit('delete', props.editingActor.id)
  }
}
</script>

<style scoped>
.form-item {
  margin-bottom: 20px;
}

.form-item label {
  display: block;
  margin-bottom: 8px;
  font-weight: bold;
  color: #333;
}

.form-item input,
.form-item select,
.form-item textarea {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.form-item textarea {
  min-height: 80px;
  resize: vertical;
}

.input-with-suggestions {
  position: relative;
}

.suggestions {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: white;
  border: 1px solid #ddd;
  border-radius: 4px;
  max-height: 200px;
  overflow-y: auto;
  z-index: 10;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.suggestion-item {
  padding: 10px;
  cursor: pointer;
  transition: background 0.2s;
}

.suggestion-item:hover {
  background: #f5f5f5;
}

.delete-btn {
  padding: 10px 30px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: opacity 0.3s;
  background: #e74c3c;
  color: white;
  margin-right: auto;
}

.delete-btn:hover {
  opacity: 0.8;
}
</style>
