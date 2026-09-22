<template>
  <div class="page highlights">
    <div class="page-header">
      <h1 class="page-title">精彩瞬间</h1>
      <span v-if="posters.length" class="tag tag--accent">{{ posters.length }} 张</span>
    </div>

    <div v-if="loading" class="skeleton wall-skeleton" aria-busy="true" aria-label="加载中"></div>

    <div v-else-if="error" class="notice notice--error">
      {{ error }}
      <button class="btn btn--sm" @click="loadPosters">重试</button>
    </div>

    <PosterWall v-else-if="posters.length" :items="posters" height="68vh" min-height="460px" :base-width="165">
      <template #caption="{ item }">{{ item.alt }}</template>
    </PosterWall>

    <div v-else class="empty">
      <p>{{ emptyHint }}</p>
      <p class="hint">海报放在海报墙目录的 default 子目录下</p>
      <router-link class="btn btn--sm" to="/settings">前往设置</router-link>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { highlightApi } from '@/scripts/api'
import PosterWall from '@/views/components/PosterWall.vue'

const posters = ref([])
const loading = ref(true)
const error = ref('')
const emptyHint = ref('暂无精彩瞬间')

const loadPosters = async () => {
  loading.value = true
  error.value = ''
  try {
    const res = await highlightApi.getPosters()
    if (res.success && Array.isArray(res.data)) {
      // 后端返回文件名数组，个别部署会直接给带 url 的对象，两种都吃
      posters.value = res.data
        .map((item, idx) => {
          const name = typeof item === 'string' ? item : ''
          const src = item?.url || (name ? `/api/highlights/poster/${encodeURIComponent(name)}` : '')
          return { key: name || src || String(idx), src, alt: name || '海报' }
        })
        .filter((p) => p.src)
      // 未配置目录 / default 不存在时后端回 success:true + 提示语，直接用它
      emptyHint.value = posters.value.length ? '暂无精彩瞬间' : res.message || '暂无精彩瞬间'
    } else {
      error.value = res.message || '精彩瞬间加载失败'
    }
  } catch (err) {
    console.error('加载失败:', err)
    // 原先这里塞了一批 picsum 假图，后端挂了也看不出来
    error.value = '精彩瞬间加载失败，请确认后端服务可用'
  } finally {
    loading.value = false
  }
}

onMounted(loadPosters)
</script>

<style scoped>
.highlights {
  display: flex;
  flex-direction: column;
  gap: var(--s4);
}

.wall-skeleton {
  height: 68vh;
  min-height: 460px;
  border-radius: var(--r2);
}

.page-header .tag {
  font-size: var(--f-md);
}

.hint {
  font-size: var(--f-sm);
}
</style>
