<template>
  <div class="page highlights">
    <div class="page-header">
      <div class="title-line">
        <h1 class="page-title">艳图</h1>
        <span class="meta">满屏春色，一墙尽收。</span>
      </div>
      <div v-if="posters.length" class="header-actions">
        <span class="tag tag--accent">{{ countLabel }}</span>
        <button v-if="canShuffle" class="btn btn--sm" @click="seed++">换一批</button>
      </div>
    </div>

    <div v-if="loading" class="skeleton wall-skeleton" aria-busy="true" aria-label="加载中"></div>

    <div v-else-if="error" class="notice notice--error">
      {{ error }}
      <button class="btn btn--sm" @click="loadPosters">重试</button>
    </div>

    <PosterWall
      v-else-if="posters.length"
      :items="posters"
      :seed="seed"
      scatter
      height="68vh"
      min-height="460px"
      :base-width="200"
      @shown="counts = $event"
    >
      <template #caption="{ item }">{{ item.alt }}</template>
    </PosterWall>

    <div v-else class="empty">
      <p>{{ emptyHint }}</p>
      <p class="hint">照片放在「艳图目录」的 default 子目录下</p>
      <router-link class="btn btn--sm" to="/settings">前往设置</router-link>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { highlightApi } from '@/scripts/api'
import PosterWall from '@/views/components/PosterWall.vue'

const posters = ref([])
const loading = ref(true)
const error = ref('')
const emptyHint = ref('暂无艳图')

// 画布不滚动，装不下就由 PosterWall 随机取一批；自增 seed 即换一批
const seed = ref(0)
const counts = ref({ shown: 0, total: 0 })

const canShuffle = computed(() => counts.value.shown < counts.value.total)
const countLabel = computed(() =>
  canShuffle.value
    ? `显示 ${counts.value.shown} / ${counts.value.total} 张`
    : `${counts.value.total} 张`
)

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
      emptyHint.value = posters.value.length ? '暂无艳图' : res.message || '暂无艳图'
    } else {
      error.value = res.message || '艳图加载失败'
    }
  } catch (err) {
    console.error('加载失败:', err)
    // 原先这里塞了一批 picsum 假图，后端挂了也看不出来
    error.value = '艳图加载失败，请确认后端服务可用'
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

/* 标题右侧的小字描述：基线对齐，窄屏换行也不会顶到操作区 */
.title-line {
  display: flex;
  align-items: baseline;
  gap: var(--s3);
  flex-wrap: wrap;
}

.page-header .tag {
  font-size: var(--f-md);
}

.hint {
  font-size: var(--f-sm);
}
</style>
