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
          <label>国家/地区</label>
          <input v-model="form.country" placeholder="国家或地区（选填）" />
        </div>
      </div>
      <div class="dialog-footer">
        <button v-if="isEdit" class="btn btn-delete" @click="handleDelete">删除</button>
        <div class="right-btns">
          <button class="btn btn-cancel" @click="handleCancel">取消</button>
          <button class="btn btn-confirm" @click="handleSave">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  visible: Boolean,
  editingActor: Object
})

const emit = defineEmits(['save', 'cancel', 'delete'])

const isEdit = ref(false)
const form = ref({
  name: '',
  alias: '',
  country: ''
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

watch(() => props.visible, (val) => {
  if (val) {
    if (props.editingActor) {
      isEdit.value = true
      form.value = {
        name: props.editingActor.name || '',
        alias: props.editingActor.alias || '',
        country: props.editingActor.country || ''
      }
    } else {
      isEdit.value = false
      form.value = { name: '', alias: '', country: '' }
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
.form-group textarea,
.form-group select {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s;
}

.form-group input:focus,
.form-group textarea:focus,
.form-group select:focus {
  border-color: #3498db;
}

.dialog-footer {
  padding: 16px 20px;
  border-top: 1px solid #eee;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.right-btns {
  display: flex;
  gap: 8px;
}

.btn {
  padding: 8px 20px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: opacity 0.2s;
}

.btn:hover {
  opacity: 0.8;
}

.btn-cancel {
  background: #ddd;
  color: #333;
}

.btn-confirm {
  background: #3498db;
  color: white;
}

.btn-delete {
  background: #e74c3c;
  color: white;
}
</style>
