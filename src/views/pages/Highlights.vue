<template>
  <div class="page highlights">
    <div class="page-header">
      <div class="title-line">
        <h1 class="page-title">艳图</h1>
        <span class="meta">满屏春色，一墙尽收。</span>
      </div>
      <div class="header-actions">
        <span v-if="posters.length" class="tag tag--accent">{{ countLabel }}</span>
        <button v-if="canShuffle" class="btn btn--sm" @click="seed++">换一批</button>
        <button
          class="btn btn--sm"
          :disabled="syncing"
          title="重新扫一遍艳图目录的 default 子目录，新增/换名/删掉的都会跟上"
          @click="syncImages"
        >
          {{ syncing ? '同步中…' : '同步照片' }}
        </button>
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
      <template #caption="{ item }">{{ item.alt }} · {{ mb(item.size) }}</template>
    </PosterWall>

    <div v-else class="empty">
      <p>{{ emptyHint }}</p>
      <p class="hint">照片放在「艳图目录」的 default 子目录下，放好后点同步</p>
      <router-link class="btn btn--sm" to="/settings">前往设置</router-link>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { highlightApi } from '@/scripts/api'
import { useUiStore, errText } from '@/scripts/store/ui'
import PosterWall from '@/views/components/PosterWall.vue'

const ui = useUiStore()

const posters = ref([])
const loading = ref(true)
const error = ref('')
const emptyHint = ref('暂无艳图')
const syncing = ref(false)

// 画布不滚动，装不下就由 PosterWall 随机取一批；自增 seed 即换一批
const seed = ref(0)
const counts = ref({ shown: 0, total: 0 })

const canShuffle = computed(() => counts.value.shown < counts.value.total)
const countLabel = computed(() =>
  canShuffle.value
    ? `显示 ${counts.value.shown} / ${counts.value.total} 张`
    : `${counts.value.total} 张`
)

const mb = (bytes) => (bytes ? `${(bytes / 1048576).toFixed(1)} MB` : '')

const loadPosters = async () => {
  loading.value = true
  error.value = ''
  try {
    const res = await highlightApi.getPosters()
    if (res.success && Array.isArray(res.data)) {
      // 墙上用 400px 缩略图（格子只有 200px 宽），点开灯箱才回源拿原图
      posters.value = res.data.map((item) => ({
        key: item.fileName,
        src: `/api/highlights/thumb/m/${encodeURIComponent(item.fileName)}`,
        full: `/api/highlights/poster/${encodeURIComponent(item.fileName)}`,
        alt: item.fileName,
        size: item.size
      }))
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

// 扫盘是显式动作：图片是人在磁盘上放的，点一下才入库，开页只读表
const syncImages = async () => {
  if (syncing.value) return
  syncing.value = true
  try {
    const res = await highlightApi.syncImages()
    if (!res.success) {
      ui.error(res.message || '同步失败')
      return
    }
    ui.success(res.message || '已同步')
    await loadPosters()
  } catch (err) {
    console.error('同步艳图失败:', err)
    ui.error('同步失败：' + errText(err))
  } finally {
    syncing.value = false
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
