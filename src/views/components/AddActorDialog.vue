<template>
  <div class="dialog-overlay" v-if="visible"
       @mousedown="handleOverlayDown"
       @click="handleOverlayClick">
    <div class="dialog">
      <div class="dialog-header">
        <h3>{{ isEdit ? '编辑演员' : '添加演员' }}</h3>
      </div>
      <div class="dialog-body">
        <div class="form-group">
          <label>姓名 <span class="required">*</span></label>
          <input v-model="form.name" placeholder="演员姓名" />
        </div>
        <div class="form-group">
          <label>别名</label>
          <input v-model="form.alias" placeholder="别名（选填）" />
        </div>
        <div class="form-group">
          <label>地区</label>
          <div class="combobox-wrap">
            <input
              v-model="form.country"
              type="text"
              placeholder="选择或输入地区"
              @focus="showCountryDropdown = true"
              @blur="hideCountryDropdown"
            />
            <div v-if="showCountryDropdown" class="combobox-dropdown">
              <div class="combobox-option" @mousedown.prevent="selectCountry('')">（无地区）</div>
              <div v-for="c in countries" :key="c" class="combobox-option" @mousedown.prevent="selectCountry(c)">{{ c }}</div>
            </div>
          </div>
        </div>
        <div class="form-group">
          <label>简介</label>
          <textarea v-model="form.bio" placeholder="简介（选填）" rows="4"></textarea>
        </div>
      </div>
      <div class="dialog-footer">
        <button v-if="isEdit" class="btn btn-danger" @click="handleDelete">删除</button>
        <div class="spacer"></div>
        <div class="right-btns">
          <button class="btn" @click="handleCancel">取消</button>
          <button class="btn btn-primary" @click="handleSave">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { actorApi } from '@/scripts/api'

const props = defineProps({
  visible: Boolean,
  editingActor: Object
})

const emit = defineEmits(['save', 'cancel', 'delete'])

const isEdit = ref(false)
const countries = ref([])
const showCountryDropdown = ref(false)
const form = ref({
  name: '',
  alias: '',
  country: '',
  bio: ''
})

let mouseDownOnDialog = false

function handleOverlayDown(e) {
  const dialog = e.currentTarget.querySelector('.dialog')
  mouseDownOnDialog = dialog && dialog.contains(e.target)
}

function handleOverlayClick() {
  if (!mouseDownOnDialog) {
    handleCancel()
  }
}

const loadCountries = async () => {
  try {
    const res = await actorApi.getList({ page: 1, pageSize: 1000 })
    if (res.success && res.data) {
      const unique = new Set()
      res.data.forEach(a => { if (a.country) unique.add(a.country) })
      countries.value = Array.from(unique).sort()
    }
  } catch (e) { console.error('加载地区列表失败', e) }
}

watch(() => props.visible, async (val) => {
  if (val) {
    await loadCountries()
    if (props.editingActor) {
      isEdit.value = true
      form.value = {
        id: props.editingActor.id || '',
        name: props.editingActor.name || '',
        alias: props.editingActor.alias || '',
        country: props.editingActor.country || '',
        bio: props.editingActor.bio || ''
      }
    } else {
      isEdit.value = false
      form.value = { id: '', name: '', alias: '', country: '', bio: '' }
    }
  }
})

const handleSave = () => {
  if (!form.value.name.trim()) {
    alert('请输入演员姓名')
    return
  }
  emit('save', { ...form.value })
}

const handleCancel = () => {
  emit('cancel')
}

const selectCountry = (val) => {
  form.value.country = val
  showCountryDropdown.value = false
}
const hideCountryDropdown = () => {
  setTimeout(() => { showCountryDropdown.value = false }, 200)
}

const handleDelete = () => {
  if (confirm('确定要删除该演员吗？')) {
    emit('delete', props.editingActor.id)
  }
}
</script>

<style scoped>
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.dialog {
  background: #fff;
  border-radius: 8px;
  width: 480px;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
}

.dialog-header {
  padding: 16px 20px;
  border-bottom: 1px solid #eee;
}

.dialog-header h3 {
  margin: 0;
  font-size: 18px;
  color: #333;
}

.dialog-body {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-group label {
  font-size: 14px;
  color: #333;
  font-weight: 500;
}

.required {
  color: #e74c3c;
}

.form-group input,
.form-group textarea {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s;
  font-family: inherit;
}

.form-group input:focus,
.form-group textarea:focus {
  border-color: #3498db;
}

.form-group textarea {
  resize: vertical;
  min-height: 80px;
}

/* Combobox */
.combobox-wrap {
  position: relative;
}

.combobox-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: #fff;
  border: 1px solid #ddd;
  border-radius: 4px;
  margin-top: 4px;
  max-height: 200px;
  overflow-y: auto;
  z-index: 10;
}

.combobox-option {
  padding: 8px 12px;
  cursor: pointer;
  font-size: 14px;
}

.combobox-option:hover {
  background: #f5f5f5;
}

.dialog-footer {
  padding: 16px 20px;
  border-top: 1px solid #eee;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.spacer {
  flex: 1;
}

.right-btns {
  display: flex;
  gap: 8px;
}

/* 统一按钮样式 - 与 CardActions 保持一致 */
.btn {
  padding: 8px 20px;
  border: 1px solid #ddd;
  background: #fff;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  color: #333;
  transition: all 0.2s;
}

.btn:hover {
  background: #f5f5f5;
}

.btn-primary {
  background: #3498db;
  color: #fff;
  border-color: #3498db;
}

.btn-primary:hover {
  background: #2980b9;
}

.btn-danger {
  background: #e74c3c;
  color: #fff;
  border-color: #e74c3c;
}

.btn-danger:hover {
  background: #c0392b;
}
</style>
