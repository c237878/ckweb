<template>
  <div class="page actor-detail">
    <div v-if="loading" class="loading-block">
      <div class="skeleton head-skeleton"></div>
      <div class="skeleton wall-skeleton"></div>
    </div>

    <div v-else-if="error" class="notice notice--error">
      {{ error }}
      <button class="btn btn--sm" @click="loadAll">重试</button>
    </div>

    <template v-else-if="actor">
      <section class="panel actor-header">
        <div class="page-header">
          <h1 class="page-title">{{ actor.name }}</h1>
          <button class="btn btn--sm" @click="openEditDialog">编辑</button>
        </div>

        <div v-if="actor.country || actor.likeCount > 0" class="tag-row">
          <span v-if="actor.country" class="tag tag--accent">{{ actor.country }}</span>
          <span v-if="actor.likeCount > 0" class="tag tag--like">♥ {{ actor.likeCount }}</span>
        </div>

        <p v-if="actor.alias" class="alias-row">别名：{{ actor.alias }}</p>
        <p v-if="actor.bio" class="bio-row">{{ decodeBio(actor.bio) }}</p>
      </section>

      <section v-if="posters.length || posterError">
        <h2 class="section-title">海报墙 ({{ posters.length }})</h2>
        <div v-if="posterError" class="notice notice--error">
          {{ posterError }}
          <button class="btn btn--sm" @click="loadPosters">重试</button>
        </div>
        <PosterWall v-else :items="posterItems" height="52vh" min-height="420px">
          <template #caption="{ item }">{{ item.alt }}</template>
        </PosterWall>
      </section>

      <section>
        <div class="videos-head">
          <h2 class="section-title">参演影片 ({{ total }})</h2>
          <div class="media-filter">
            <SelectList
              v-model="mediaAttrFilter"
              :options="mediaFlagOptions"
              all-label="全部片源"
              label="按片源筛选影片"
            />
          </div>
        </div>

        <div v-if="videosLoading" class="grid" aria-busy="true" aria-label="加载中">
          <div v-for="n in Math.min(pageSize, 24)" :key="n" class="skeleton card-skeleton"></div>
        </div>

        <div v-else-if="videosError" class="notice notice--error">{{ videosError }}</div>

        <div v-else-if="videos.length" class="grid">
          <VideoCard v-for="video in videos" :key="video.id" :video="video" />
        </div>

        <div v-else class="empty">
          <p>{{ mediaAttrFilter ? '没有该片源的影片' : '该演员暂无影片' }}</p>
          <button v-if="mediaAttrFilter" class="btn btn--sm" @click="mediaAttrFilter = ''">清除筛选</button>
        </div>

        <Pagination v-model:page="page" :page-size="pageSize" :total="total" @change="loadVideos" />
      </section>

      <AddActorDialog
        :visible="showEditDialog"
        :editing-actor="actor"
        @save="onEditSave"
        @cancel="showEditDialog = false"
        @delete="onDelete"
      />
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { actorApi } from '@/scripts/api'
import { useAppStore } from '@/scripts/store/app'
import { useUiStore, errText } from '@/scripts/store/ui'
import { MEDIA_FLAGS } from '@/scripts/constants'
import VideoCard from '@/views/components/VideoCard.vue'
import AddActorDialog from '@/views/components/AddActorDialog.vue'
import PosterWall from '@/views/components/PosterWall.vue'
import Pagination from '@/views/components/Pagination.vue'
import SelectList from '@/views/components/SelectList.vue'

const route = useRoute()
const router = useRouter()
const app = useAppStore()
const ui = useUiStore()

const actor = ref(null)
const posters = ref([])
const posterError = ref('')
const videos = ref([])
const page = ref(1)
const total = ref(0)

const loading = ref(true)
const error = ref('')
const videosLoading = ref(false)
const videosError = ref('')

const mediaAttrFilter = ref('')
const showEditDialog = ref(false)

const pageSize = computed(() => app.pageSize)

// 片源筛选下沉到后端，所以 '0'（未标记）是一个真实的筛选值而不是"排除"
const mediaFlagOptions = computed(() =>
  Object.entries(MEDIA_FLAGS).map(([value, flag]) => ({
    value,
    label: value === '0' ? '未设置' : flag.short || flag.long
  }))
)

const actorId = computed(() => route.params.id)

const posterItems = computed(() =>
  posters.value.map((name) => ({
    key: name,
    src: `/api/actor/${actorId.value}/poster/${encodeURIComponent(name)}`,
    alt: name
  }))
)

// 解码简介中可能包含的 URL 编码文本
const decodeBio = (text) => {
  try {
    return decodeURIComponent(text)
  } catch {
    return text
  }
}

const openEditDialog = () => {
  showEditDialog.value = true
}

const onEditSave = async (formData) => {
  try {
    await actorApi.update(actor.value.id, formData)
    showEditDialog.value = false
    await loadActor()
    ui.success('已保存')
  } catch (err) {
    console.error('保存演员失败:', err)
    ui.error('保存失败：' + errText(err))
  }
}

const onDelete = async (id) => {
  const go = await ui.confirm({ title: '确认删除', message: '确定要删除该演员吗？', danger: true })
  if (!go) return
  try {
    await actorApi.delete(id)
    showEditDialog.value = false
    ui.success('已删除')
    // 删除后回到演员列表（原先跳的是 /actor，路由里没有这条，会白屏）
    router.push('/actors')
  } catch (err) {
    console.error('删除演员失败:', err)
    ui.error('删除失败：' + errText(err))
  }
}

const loadActor = async () => {
  try {
    const res = await actorApi.getDetail(route.params.id)
    if (res.success) {
      actor.value = res.data
      return ''
    }
    return res.message || '演员信息加载失败'
  } catch (err) {
    console.error('加载演员详情失败:', err)
    return err.response?.status === 404 ? '演员不存在或已被删除' : '演员信息加载失败，请确认后端服务可用'
  }
}

const loadVideos = async () => {
  videosLoading.value = true
  videosError.value = ''
  try {
    const params = { page: page.value, pageSize: pageSize.value }
    if (mediaAttrFilter.value !== '') params.mediaAttrFlags = parseInt(mediaAttrFilter.value)
    const res = await actorApi.getVideos(route.params.id, params)
    if (res.success) {
      videos.value = res.data || []
      total.value = res.total || 0
    } else {
      videosError.value = res.message || '参演影片加载失败'
    }
  } catch (err) {
    console.error('加载演员影片失败:', err)
    videosError.value = '参演影片加载失败，请确认后端服务可用'
  } finally {
    videosLoading.value = false
  }
}

const loadPosters = async () => {
  posterError.value = ''
  try {
    const res = await actorApi.getPosters(route.params.id)
    if (res.success && Array.isArray(res.data)) posters.value = res.data
    else posters.value = []
  } catch (err) {
    console.error('加载海报失败:', err)
    posters.value = []
    posterError.value = '海报墙加载失败，请确认后端服务可用'
  }
}

const loadAll = async () => {
  loading.value = true
  error.value = ''
  const message = await loadActor()
  loading.value = false
  if (message) {
    error.value = message
    return
  }
  await Promise.all([loadVideos(), loadPosters()])
}

onMounted(async () => {
  await app.init()
  await loadAll()
})

// 监听路由参数变化
watch(
  () => route.params.id,
  (newId) => {
    if (!newId) return
    actor.value = null
    page.value = 1
    mediaAttrFilter.value = ''
    loadAll()
  }
)

// 筛选是服务端行为，改动后回到第一页重新取
watch(mediaAttrFilter, () => {
  // 切换演员时 loadAll 会自己取影片，别抢它
  if (loading.value) return
  page.value = 1
  loadVideos()
})
</script>

<style scoped>
.actor-detail {
  display: flex;
  flex-direction: column;
  gap: var(--s5);
}

.loading-block {
  display: flex;
  flex-direction: column;
  gap: var(--s5);
}

.head-skeleton {
  height: calc(var(--s7) * 3);
  border-radius: var(--r2);
}

.wall-skeleton {
  height: 52vh;
  min-height: 420px;
  border-radius: var(--r2);
}

.actor-header {
  display: flex;
  flex-direction: column;
  gap: var(--s3);
}

.tag-row {
  display: flex;
  align-items: center;
  gap: var(--s2);
  flex-wrap: wrap;
}

.alias-row {
  color: var(--text-dim);
  font-size: var(--f-md);
}

.bio-row {
  color: var(--text-dim);
  font-size: var(--f-md);
  line-height: 1.7;
  white-space: pre-wrap;
}

.videos-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--s3);
  flex-wrap: wrap;
}

.media-filter .select {
  min-width: 132px;
}

/* 封面 3:2 再加约三行文字的高度 */
.card-skeleton {
  aspect-ratio: 1 / 1.08;
  border-radius: var(--r2);
}
</style>
