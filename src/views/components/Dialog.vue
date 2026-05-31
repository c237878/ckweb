<template>
  <div class="dialog-overlay" v-if="visible" @mousedown="handleOverlayDown" @click="handleOverlayClick">
    <div class="dialog">
      <h3>{{ title }}</h3>
      <slot name="content"></slot>
      <div class="dialog-actions">
        <slot name="actions"></slot>
        <button class="cancel-btn" @click="handleCancel">取消</button>
        <button class="confirm-btn" @click="handleConfirm">保存</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { defineProps, defineEmits } from 'vue'

const props = defineProps({
  visible: Boolean,
  title: String
})

const emit = defineEmits(['confirm', 'cancel'])

// 与 logbot AddExpense.vue 完全一致的写法
// 关键：不在 click 里重置 flag，让它保持到下次 mousedown 再覆盖
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

const handleConfirm = () => {
  emit('confirm')
}

const handleCancel = () => {
  emit('cancel')
}
</script>

<style scoped>
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.dialog {
  background: white;
  padding: 30px;
  border-radius: 8px;
  width: 90%;
  max-width: 600px;
  max-height: 80vh;
  overflow-y: auto;
}

.dialog h3 {
  margin-bottom: 20px;
  font-size: 18px;
  color: #2c3e50;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 15px;
  margin-top: 25px;
  padding-top: 15px;
  border-top: 1px solid #eee;
}

.cancel-btn,
.confirm-btn {
  padding: 10px 30px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: opacity 0.3s;
}

.cancel-btn {
  background: #95a5a6;
  color: white;
}

.confirm-btn {
  background: #e74c3c;
  color: white;
}

.cancel-btn:hover,
.confirm-btn:hover {
  opacity: 0.8;
}
</style>
