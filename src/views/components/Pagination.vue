<template>
  <nav class="pagination" v-if="total > 0" aria-label="分页">
    <button class="btn btn--sm" :disabled="page <= 1" @click="go(page - 1)">上一页</button>

    <span class="page-info">
      <span class="phrase">第 <strong>{{ page }}</strong> / {{ totalPages }} 页</span>
      <em class="total">共 {{ total }} 条</em>
    </span>

    <input
      class="input goto"
      v-model.number="target"
      type="number"
      min="1"
      :max="totalPages"
      placeholder="页码"
      aria-label="跳转到指定页"
      @keyup.enter="jump"
    />
    <button class="btn btn--sm" @click="jump">跳转</button>
    <button class="btn btn--sm" :disabled="page >= totalPages" @click="go(page + 1)">下一页</button>
  </nav>
</template>

<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  page: { type: Number, required: true },
  pageSize: { type: Number, required: true },
  total: { type: Number, default: 0 }
})

const emit = defineEmits(['update:page', 'change'])

const target = ref()

const totalPages = computed(() => Math.max(1, Math.ceil(props.total / props.pageSize)))

// 翻页后输入框里留下的页码要清掉，否则下次跳转用旧值
watch(() => props.page, () => { target.value = undefined })

const go = (p) => {
  if (p < 1 || p > totalPages.value || p === props.page) return
  emit('update:page', p)
  emit('change', p)
}

const jump = () => {
  const p = Number(target.value)
  if (!Number.isFinite(p)) return
  go(Math.min(Math.max(1, Math.trunc(p)), totalPages.value))
  target.value = undefined
}
</script>

<style scoped>
.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--s2);
  flex-wrap: wrap;
}

.page-info {
  color: var(--text-dim);
  font-size: var(--f-md);
  display: flex;
  align-items: center;
  gap: var(--s2);
}

.page-info strong {
  color: var(--accent);
  font-variant-numeric: tabular-nums;
}

.page-info .total {
  font-style: normal;
  color: var(--text-faint);
  font-size: var(--f-sm);
}

.goto {
  width: 78px;
  text-align: center;
}

.goto::-webkit-outer-spin-button,
.goto::-webkit-inner-spin-button {
  appearance: none;
  margin: 0;
}
</style>
