<template>
  <div class="page notfound">
    <p class="code">404</p>
    <h1 class="title">页面不存在</h1>
    <p class="hint">地址可能失效了，或者内容已被删除。</p>
    <div class="actions">
      <router-link class="btn btn--primary" to="/">回到首页</router-link>
      <button class="btn" @click="router.back()">返回上一页</button>
    </div>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'

const router = useRouter()
</script>

<style scoped>
.notfound {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--s3);
  min-height: 56vh;
  text-align: center;
}

.code {
  font-size: 72px;
  font-weight: 800;
  line-height: 1;
  color: var(--border-strong);
}

.title {
  font-size: var(--f-2xl);
}

.hint {
  color: var(--text-dim);
}

.actions {
  display: flex;
  gap: var(--s2);
}
</style>
