<template>
  <div class="card-actions">
    <slot></slot>
  </div>
</template>

<script setup>
</script>

<style scoped>
.card-actions {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  border-top: 1px solid #f0f0f0;
}

/* 统一按钮样式 */
.card-actions :deep(.btn) {
  padding: 5px 14px;
  border: 1px solid #ddd;
  background: #fff;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  color: #333;
  transition: all 0.2s;
}

.card-actions :deep(.btn:hover) {
  background: #f5f5f5;
}

.card-actions :deep(.btn-primary) {
  background: #3498db;
  color: #fff;
  border-color: #3498db;
}

.card-actions :deep(.btn-primary:hover) {
  background: #2980b9;
}

.card-actions :deep(.btn-success) {
  background: #28a745;
  color: #fff;
  border-color: #28a745;
}

.card-actions :deep(.btn-success:hover) {
  background: #218838;
}

.card-actions :deep(.btn-danger) {
  background: #e74c3c;
  color: #fff;
  border-color: #e74c3c;
}

.card-actions :deep(.btn-danger:hover) {
  background: #c0392b;
}
</style>
