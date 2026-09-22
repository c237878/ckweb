<template>
  <div class="card-actions">
    <slot></slot>
  </div>
</template>

<style scoped>
/* 只负责排布；按钮外观统一走 main.css 里的 .btn 系列，
   原先这里用 :deep() 覆写了一套浅色按钮样式，会把主题盖掉。 */
.card-actions {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 6px;
  padding: var(--s2) var(--s3);
  border-top: 1px solid var(--border);
}
</style>
