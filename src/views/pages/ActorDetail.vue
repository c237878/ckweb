<template>
  <div class="page actor-detail">
    <div v-if="loading" class="loading-block">
      <div class="skeleton head-skeleton"></div>
      <div class="skeleton album-skeleton"></div>
    </div>

    <div v-else-if="error" class="notice notice--error">
      {{ error }}
      <button class="btn btn--sm" @click="loadAll">重试</button>
    </div>

    <template v-else-if="actor">
      <section class="panel actor-header" :class="{ 'actor-header--split': images.length }">
        <div class="actor-header__text">
          <div class="page-header">
            <h1 class="page-title">{{ actor.name }}</h1>
            <button class="btn btn--sm" @click="openEditDialog">编辑</button>
          </div>

          <div v-if="actor.country || actor.likeCount > 0 || actor.birthdate" class="tag-row">
            <span v-if="actor.country" class="tag tag--accent">{{ actor.country }}</span>
            <span v-if="actor.likeCount > 0" class="tag tag--like">♥ {{ actor.likeCount }}</span>
            <span v-if="actor.birthdate" class="tag" :title="`出生日期 ${actor.birthdate}`">生日 {{ actor.birthdate }}</span>
          </div>

          <p v-if="actor.aliases?.length" class="alias-row">曾用名：{{ actor.aliases.join('、') }}</p>

          <div v-if="safeLinks.length" class="tag-row">
            <a
              v-for="link in safeLinks"
              :key="link.url"
              class="tag tag--info"
              :href="link.url"
              target="_blank"
              rel="noopener noreferrer"
              :title="link.url"
            >{{ linkLabel(link) }}</a>
          </div>

          <p v-if="actor.bio" class="bio-row">{{ decodeBio(actor.bio) }}</p>
        </div>

        <ActorAlbum
          :actor-id="actorId"
          :images="images"
          :name="actor.name"
          :syncing="syncing"
          :fetching="fetching"
          :scrapeable="actor.scrapeable !== false"
          empty-text="这位演员还没有照片"
          @sync="syncImages"
          @set-primary="setPrimary"
          @fetch-meta="fetchMeta"
          @crop-from-cover="showCropDialog = true"
        />
      </section>

      <section>
        <div class="videos-head">
          <h2 class="section-title">参演影片 ({{ total }})</h2>
          <div class="media-filter">
            <SelectList
              v-model="sourceFilter.subtitle"
              :options="SUBTITLE_OPTIONS"
              all-label="全部字幕"
              label="按字幕情况筛选影片"
            />
            <SelectList
              v-model="sourceFilter.watermark"
              :options="WATERMARK_OPTIONS"
              all-label="全部水印"
              label="按广告水印筛选影片"
            />
            <SelectList
              v-model="sourceFilter.resolution"
              :options="RESOLUTION_OPTIONS"
              all-label="全部分辨率"
              label="按分辨率筛选影片"
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
          <p>{{ hasSourceFilter ? '没有符合这个片源条件的影片' : '该演员暂无影片' }}</p>
          <button v-if="hasSourceFilter" class="btn btn--sm" @click="clearSourceFilter">清除筛选</button>
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

      <CoverCropDialog
        :visible="showCropDialog"
        :actor-id="actorId"
        :name="actor?.name || ''"
        @saved="onCropSaved"
        @cancel="showCropDialog = false"
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
import {
  SUBTITLE_OPTIONS, WATERMARK_OPTIONS, RESOLUTION_OPTIONS, linkKindLabel
} from '@/scripts/constants'
import VideoCard from '@/views/components/VideoCard.vue'
import AddActorDialog from '@/views/components/AddActorDialog.vue'
import ActorAlbum from '@/views/components/ActorAlbum.vue'
import CoverCropDialog from '@/views/components/CoverCropDialog.vue'
import Pagination from '@/views/components/Pagination.vue'
import SelectList from '@/views/components/SelectList.vue'

const route = useRoute()
const router = useRouter()
const app = useAppStore()
const ui = useUiStore()

const actor = ref(null)
const syncing = ref(false)
const fetching = ref(false)
const showCropDialog = ref(false)
const videos = ref([])
const page = ref(1)
const total = ref(0)

const loading = ref(true)
const error = ref('')
const videosLoading = ref(false)
const videosError = ref('')

// 片源三维筛选（都下沉到后端，所以"未标记"是一个真实筛选值而不是排除）
const sourceFilter = ref({ subtitle: '', watermark: '', resolution: '' })
const hasSourceFilter = computed(() => Object.values(sourceFilter.value).some((v) => v !== ''))
const clearSourceFilter = () => { sourceFilter.value = { subtitle: '', watermark: '', resolution: '' } }
const showEditDialog = ref(false)

const pageSize = computed(() => app.pageSize)

// 后端写入时已校验过 scheme，这里再挡一道：非 http(s) 不渲染成链接，
// 免得哪天直接改库把 javascript: 塞进来就是一条现成的 XSS
const safeLinks = computed(() =>
  (actor.value?.links || []).filter((l) => /^https?:\/\//i.test(l.url || ''))
)

// 同一类型常挂好几个站（资料页尤其多），只写类型看不出是哪个，补一段主机名
const linkLabel = (link) => {
  const host = (link.url.match(/^https?:\/\/([^/]+)/i)?.[1] || '').replace(/^www\./i, '')
  return host ? `${linkKindLabel(link.kind)} ${host}` : linkKindLabel(link.kind)
}

const actorId = computed(() => route.params.id)

// 图片清单由详情接口一次带出（来自 actor_images 表），不再单独请求
const images = computed(() => (Array.isArray(actor.value?.images) ? actor.value.images : []))

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
    const { subtitle, watermark, resolution } = sourceFilter.value
    if (subtitle) params.subtitle = subtitle
    if (watermark) params.watermark = watermark
    if (resolution) params.resolution = resolution
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

// 扫盘是显式动作：照片是人在磁盘上放的，界面上点一下才入库，
// 详情页加载时不再为了"看看有没有图"去读挂载卷
const syncImages = async () => {
  if (syncing.value) return
  syncing.value = true
  try {
    const res = await actorApi.syncImages(route.params.id)
    if (!res.success) {
      ui.error(res.message || '同步失败')
      return
    }
    ui.success(res.message || '已同步')
    await loadActor()
  } catch (err) {
    console.error('同步演员图片失败:', err)
    ui.error('同步失败：' + errText(err))
  } finally {
    syncing.value = false
  }
}

// 换列表页那张脸：后端整组换主图标记，这里重取一次详情让相册与徽章跟上
const setPrimary = async (fileName) => {
  try {
    const res = await actorApi.setPrimaryImage(route.params.id, fileName)
    if (!res.success) {
      ui.error(res.message || '设置失败')
      return
    }
    ui.success(res.message || '已设为头像')
    await loadActor()
  } catch (err) {
    console.error('设置演员头像失败:', err)
    ui.error('设置失败：' + errText(err))
  }
}

// 从封面截完：新图已经进了 actor_images 并且是主图，重取一次详情让相册与头像跟上
const onCropSaved = async (res) => {
  showCropDialog.value = false
  ui.success(res?.message || '已设为头像')
  await loadActor()
}

// 抓不到是常态（站上没有档案、或名字对不上），所以原因用同一条 toast 说清楚，
// 不要静默失败让人以为按钮坏了
const scrape = async (fn, fallback) => {
  if (fetching.value) return
  fetching.value = true
  try {
    const res = await fn(route.params.id)
    if (res.success) ui.success(res.message || '已抓取')
    else ui.warn(res.message || fallback)
    await loadActor()
  } catch (err) {
    console.error('抓取演员信息失败:', err)
    ui.error('抓取失败：' + errText(err))
  } finally {
    fetching.value = false
  }
}

// 来源由相册里那个下拉框带上来：两个档案源补的字段不一样
const fetchMeta = (src) => scrape((id) => actorApi.fetchMeta(id, src), '没抓到')

const loadAll = async () => {
  loading.value = true
  error.value = ''
  const message = await loadActor()
  loading.value = false
  if (message) {
    error.value = message
    return
  }
  await loadVideos()
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
    clearSourceFilter()
    loadAll()
  }
)

// 筛选是服务端行为，改动后回到第一页重新取（三维存在一个对象里，要 deep 才看得到里面变了）
watch(
  sourceFilter,
  () => {
    // 切换演员时 loadAll 会自己取影片，别抢它
    if (loading.value) return
    page.value = 1
    loadVideos()
  },
  { deep: true }
)
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

.album-skeleton {
  height: 420px;
  border-radius: var(--r2);
}

/* 默认单栏；只有真的拿到照片才分两栏，空相册不值得占掉半页宽 */
.actor-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-items: start;
  gap: var(--s4);
}

/* 断点与影视卡片的完全形态同一条线，避免同一页上两处各自换行 */
@media (min-width: 900px) {
  .actor-header--split {
    grid-template-columns: minmax(0, 1fr) minmax(240px, 380px);
    /* 文字通常比相册矮一截，顶对齐会在左栏留出一大块空白 */
    align-items: center;
  }
}

.actor-header__text {
  display: flex;
  flex-direction: column;
  gap: var(--s3);
  min-width: 0;
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

/* 三维筛选横排在标题右侧，放不下就换行（不套 .filters 那个带底色的框，这里已经在板块头里） */
.media-filter {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--s2);
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
