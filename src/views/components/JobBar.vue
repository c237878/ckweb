<template>
  <div class="job-bar">
    <div class="job-bar__meta">
      <span class="job-bar__text">{{ text }}</span>
      <span class="job-bar__pct">{{ percent }}%</span>
    </div>
    <div
      class="job-bar__track"
      role="progressbar"
      :aria-valuenow="percent"
      aria-valuemin="0"
      aria-valuemax="100"
      :aria-label="text"
    >
      <span class="job-bar__fill" :style="{ width: `${percent}%` }"></span>
    </div>
  </div>
</template>

<script setup>
defineProps({
  /** 已经组织好的一行说明，组件不管进度语义只管画 */
  text: { type: String, required: true },
  percent: { type: Number, default: 0 }
})
</script>

<style scoped>
.job-bar {
  display: flex;
  flex-direction: column;
  gap: var(--s2);
  padding: var(--s3);
  background: var(--bg-elev);
  border: 1px solid var(--border);
  border-radius: var(--r2);
}

.job-bar__meta {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--s3);
  font-size: var(--f-sm);
  color: var(--text-dim);
  font-variant-numeric: tabular-nums;
}

.job-bar__pct {
  color: var(--accent);
  font-weight: 600;
}

.job-bar__track {
  height: 6px;
  overflow: hidden;
  border-radius: var(--rp);
  background: var(--bg-elev-2);
}

.job-bar__fill {
  display: block;
  height: 100%;
  border-radius: var(--rp);
  background: var(--accent);
  /* 进度是每 2 秒跳一次，补个过渡让它看着是连续走的 */
  transition: width 900ms linear;
}
</style>
