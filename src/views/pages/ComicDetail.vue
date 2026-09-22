<template>
  <div class="page comic-detail" v-if="comic">
    <!-- 头部 -->
    <div class="page-header">
      <h1 class="page-title comic-title" :title="comic.name">
        <span class="comic-name">{{ comic.name }}</span>
        <span class="author" v-if="comic.author">作者：{{ comic.author }}</span>
        <span v-if="isCompleted" class="tag tag--danger">完结</span>
        <span v-if="likeCount" class="tag tag--like">♥ {{ likeCount }}</span>
      </h1>
      <div class="header-actions">
        <button class="btn btn--sm" @click="$router.back()">返回</button>
        <button class="btn btn--sm like-btn" :disabled="likeDisabled" @click="handleLike">点赞</button>
        <button
          v-if="!isCompleted"
          class="btn btn--sm"
          :disabled="refreshing"
          title="重新扫描章节目录，并让本章节图片重新回源"
          @click="refreshImages"
        >
{{ refreshing ? '刷新中...' : '刷新图片' }}
</button>
        <button v-if="!isCompleted" class="btn btn--sm btn--primary" @click="showEdit = true">编辑</button>
        <button v-if="!isCompleted" class="btn btn--sm btn--danger" @click="handleDelete">删除</button>
      </div>
    </div>

    <!-- 基本信息 -->
    <div class="panel comic-info" v-if="comic.description || comic.url || comic.directory">
      <div class="info-row" v-if="comic.description">
        <span class="label">简介</span>
        <span class="value">{{ comic.description }}</span>
      </div>
      <div class="info-row" v-if="comic.url">
        <span class="label">链接</span>
        <a :href="comic.url" target="_blank" rel="noopener noreferrer" class="value link">{{ comic.url }}</a>
      </div>
      <div class="info-row" v-if="comic.directory">
        <span class="label">目录</span>
        <span class="value path">{{ comic.directory }}</span>
      </div>
    </div>

    <!-- 章节标签 + 图片区 -->
    <div class="main-area">
      <button v-if="!isCompleted" class="btn btn--sm btn--primary" @click="openAddChapter">添加章节</button>

      <!-- 章节标签栏：标签本体是个按钮，编辑/删除挂在旁边（按钮不能套按钮） -->
      <nav class="chapter-tabs" aria-label="章节列表">
        <div
          v-for="ch in chapters"
          :key="ch.id"
          class="chapter-tab"
          :class="{ active: currentChapter?.id === ch.id }"
        >
          <button
            class="tab-main"
            :title="ch.title"
            :aria-current="currentChapter?.id === ch.id ? 'true' : undefined"
            @click="selectChapter(ch)"
          >
            <span class="tab-title">{{ ch.title }}</span>
            <span class="tab-count">{{ ch.imageCount }} 图</span>
          </button>
          <span class="tab-actions" v-if="!isCompleted">
            <button
              class="tab-action"
              title="编辑章节"
              :aria-label="`编辑章节 ${ch.title}`"
              @click.stop="openEditChapter(ch)"
            >&#9998;</button>
            <button
              class="tab-action tab-action-danger"
              title="删除章节"
              :aria-label="`删除章节 ${ch.title}`"
              @click.stop="deleteChapter(ch)"
            >&times;</button>
          </span>
        </div>
      </nav>

      <div class="empty" v-if="chapters.length === 0">
        暂无章节，点击上方「添加章节」按钮新增
      </div>
      <div class="empty" v-else-if="!currentChapter">
        请选择一个章节
      </div>

      <!-- 图片区 -->
      <div class="viewer-section" v-else>
        <!-- 解密工具栏 -->
        <div v-if="!isCompleted" class="panel decrypt-toolbar" :class="{ floating: floatMode }">
          <label class="decrypt-group">
            <span class="group-label">切割行数</span>
            <input v-model.number="decryptConfig.rows" class="input num" type="number" min="2" @change="syncOrderLength" />
          </label>

          <label class="decrypt-group">
            <span class="group-label">顶部留高</span>
            <input v-model.number="decryptConfig.topPadding" class="input num" type="number" min="0" placeholder="0" />
          </label>

          <label class="decrypt-group">
            <span class="group-label">底部留高</span>
            <input v-model.number="decryptConfig.bottomPadding" class="input num" type="number" min="0" placeholder="0" />
          </label>

          <label class="decrypt-group">
            <span class="group-label">排列顺序</span>
            <input v-model="orderText" class="input order-text" type="text" placeholder="如 2,1,0" @blur="applyOrderText" />
            <small class="group-hint">{{ decryptConfig.rows }} 个 0~{{ decryptConfig.rows - 1 }} 的整数</small>
          </label>

          <label class="decrypt-group check">
            <input type="checkbox" v-model="decryptConfig.overwrite" />
            <span>覆盖已解密</span>
          </label>

          <div class="decrypt-actions">
            <button class="btn btn--sm btn--primary" :disabled="decrypting" @click="decryptAllImages">
              {{ decrypting ? '解密中…' : '批量解密' }}
            </button>
            <button v-if="hasDecrypted" class="btn btn--sm" :disabled="restoring" @click="restoreAllImages">
              {{ restoring ? '还原中…' : '批量还原' }}
            </button>
            <button
              class="btn btn--sm"
              :aria-pressed="floatMode"
              :title="floatMode ? '取消漂浮' : '漂浮模式'"
              @click="floatMode = !floatMode"
            >
{{ floatMode ? '固定' : '漂浮' }}
</button>
          </div>
        </div>

        <!-- 图片网格 -->
        <div class="image-toolbar">
          <div class="chapter-badge">
            <span class="chapter-name">{{ currentChapter.title }}</span>
            <span class="tag">{{ filteredImages.length }} 图</span>
          </div>
          <div v-if="!isCompleted" class="image-toolbar-filter">
            <label class="check">
              <input
                type="checkbox"
                :checked="imageFilter === 'decrypted'"
                @change="imageFilter = $event.target.checked ? 'decrypted' : 'all'"
              />
              <span>仅显示已解密</span>
            </label>
            <label class="check">
              <input
                type="checkbox"
                :checked="imageFilter === 'undecrypted'"
                @change="imageFilter = $event.target.checked ? 'undecrypted' : 'all'"
              />
              <span>仅显示未解密</span>
            </label>
          </div>
        </div>

        <div class="image-grid" v-if="filteredImages.length">
          <div
            v-for="(img, idx) in filteredImages"
            :key="img.fileName"
            class="image-item"
            @click="openViewer(idx)"
          >
            <div class="cover tile-cover" :class="{ 'is-decrypted': img.isDecrypted }">
              <img
                v-if="!failedImages.has(img.fileName)"
                :src="getImageUrl(img)"
                :alt="pageLabel(idx)"
                loading="lazy"
                decoding="async"
                @error="failedImages.add(img.fileName)"
              />
              <!-- 图片回源失败时留页码占位，比整格空白好认 -->
              <span v-else class="cover-fallback">{{ idx + 1 }}</span>
              <span v-if="img.isDecrypted" class="img-badge badge-decrypted" title="已解密">&#10003;</span>
              <span class="img-badge badge-index">{{ idx + 1 }}</span>
            </div>
            <div class="image-actions" v-if="!isCompleted">
              <button v-if="!img.isDecrypted" class="btn btn--sm btn--primary" @click.stop="decryptSingle(img)">解密</button>
              <button v-else class="btn btn--sm" @click.stop="restoreSingle(img)">还原</button>
              <button
                v-if="!comic.coverPath"
                class="btn btn--sm"
                :disabled="settingCover"
                @click.stop="setAsCover(img)"
              >
设为封面
</button>
            </div>
          </div>
        </div>

        <div class="empty" v-else>该章节暂无图片</div>
      </div>
    </div>

    <!-- 图片查看器 -->
    <div
      v-if="viewer.show"
      ref="viewerPanel"
      class="overlay viewer"
      role="dialog"
      aria-modal="true"
      aria-label="漫画图片查看器"
      tabindex="-1"
      @click.self="closeViewer"
    >
      <button class="viewer__close" aria-label="关闭查看器" @click="closeViewer">&times;</button>
      <button class="viewer__nav viewer__prev" :disabled="viewer.index <= 0" aria-label="上一张" @click="prevImage">&#9664;</button>

      <figure class="viewer__stage">
        <img v-if="viewerSrc && !viewerError" :src="viewerSrc" :alt="pageLabel(viewer.index)" @error="viewerError = true" />
        <figcaption class="viewer__info">
          <span v-if="viewerError" class="viewer__error">图片加载失败</span>
          <template v-else>
            <span class="viewer__count">{{ viewer.index + 1 }} / {{ filteredImages.length }}</span>
            <span v-if="viewerImage?.isDecrypted" class="tag tag--success">已解密</span>
          </template>
          <span class="viewer__name">{{ viewerImage?.fileName }}</span>
        </figcaption>

        <div class="viewer__controls">
          <button class="btn btn--sm" @click="togglePlay">
            {{ viewerPlaying ? '暂停' : '播放' }}
          </button>
          <div class="speed-control">
            <label for="play-speed">间隔</label>
            <input id="play-speed" v-model.number="playSpeed" class="speed-input" type="number" min="100" max="10000" step="100" />
            <span>ms</span>
            <div class="speed-presets">
              <button
                v-for="s in [300, 500, 1000, 2000]"
                :key="s"
                class="speed-preset"
                :class="{ active: playSpeed === s }"
                :aria-pressed="playSpeed === s"
                @click="playSpeed = s"
              >
{{ s }}
</button>
            </div>
          </div>
        </div>
      </figure>

      <button
        class="viewer__nav viewer__next"
        :disabled="viewer.index >= filteredImages.length - 1"
        aria-label="下一张"
        @click="nextImage"
      >
&#9654;
</button>
    </div>

    <!-- 章节对话框：新增与编辑共用一份表单（遮罩/Esc/焦点由 Dialog 统一管） -->
    <Dialog
      :visible="chapterDialog !== ''"
      :title="isAddChapter ? '添加章节' : '编辑章节'"
      size="sm"
      @cancel="chapterDialog = ''"
    >
      <template #content>
        <div class="chapter-form">
          <div class="field">
            <label for="chapter-title">章节标题</label>
            <input
              id="chapter-title"
              v-model="chapterForm.title"
              class="input"
              type="text"
              :placeholder="isAddChapter ? '默认为目录名' : '章节标题'"
            />
          </div>
          <div class="field">
            <label for="chapter-dir">章节目录 <span v-if="isAddChapter" class="required">*</span></label>
            <input id="chapter-dir" v-model="chapterForm.directory" class="input" type="text" placeholder="章节图片所在目录的完整路径" />
            <span class="form-hint">
              {{ isAddChapter ? '填写漫画章节图片所在文件夹的完整路径' : '修改后若目录不同，将重新统计图片数量' }}
            </span>
          </div>
          <div class="field" v-if="!isAddChapter">
            <label for="chapter-sort">排序号</label>
            <input id="chapter-sort" v-model.number="chapterForm.sortOrder" class="input" type="number" min="0" placeholder="数字越小越靠前" />
          </div>
        </div>
      </template>

      <template #actions>
        <button class="btn" @click="chapterDialog = ''">取消</button>
        <button class="btn btn--primary" @click="submitChapter">{{ isAddChapter ? '添加' : '保存' }}</button>
      </template>
    </Dialog>

    <!-- 编辑漫画对话框：与漫画列表页共用同一个表单 -->
    <ComicFormDialog
      :visible="showEdit"
      :editing-comic="comic"
      :saving="savingComic"
      @update:visible="showEdit = $event"
      @save="handleUpdate"
      @cancel="showEdit = false"
    />
  </div>

  <div class="page" v-else-if="loading">
    <div class="empty" aria-busy="true">
      <span class="spinner" aria-hidden="true"></span>
      <span>加载中…</span>
    </div>
  </div>

  <div class="page" v-else>
    <div class="notice notice--error">
      {{ error || '漫画不存在或已被删除' }}
      <router-link class="link" to="/comics">返回漫画列表</router-link>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { comicApi } from '@/scripts/api'
import { useUiStore, errText } from '@/scripts/store/ui'
import ComicFormDialog from '@/views/components/ComicFormDialog.vue'
import Dialog from '@/views/components/Dialog.vue'

const route = useRoute()
const router = useRouter()
const ui = useUiStore()

const comic = ref(null)
const chapters = ref([])
const currentChapter = ref(null)
const loading = ref(true)
const error = ref('')
const showEdit = ref(false)
const savingComic = ref(false)
// 章节对话框：'' | 'add' | 'edit'
const chapterDialog = ref('')
const editingChapter = ref(null)

// 图片筛选：单选状态，两个复选框共用，避免"同时勾上"这种自相矛盾的态
const imageFilter = ref('all')

const chapterForm = ref({ title: '', directory: '', sortOrder: 0 })
const images = ref([])
const failedImages = ref(new Set())

const decryptConfig = ref({ rows: 3, order: [2, 1, 0], overwrite: true, topPadding: 0, bottomPadding: 0 })
const orderText = ref('2,1,0')        // 文本形式绑定
const decrypting = ref(false)
const refreshing = ref(false)
const restoring = ref(false)
const settingCover = ref(false)
const floatMode = ref(false)
const likeCount = ref(0)
const likeDisabled = ref(false)

const viewer = ref({ show: false, index: 0 })

const hasDecrypted = computed(() => images.value.some(img => img.isDecrypted))
const isCompleted = computed(() => comic.value?.status === 1)
const isAddChapter = computed(() => chapterDialog.value === 'add')
const filteredImages = computed(() => {
  if (imageFilter.value === 'decrypted') return images.value.filter(img => img.isDecrypted)
  if (imageFilter.value === 'undecrypted') return images.value.filter(img => !img.isDecrypted)
  return images.value
})

// ---------- 图片 URL 与缓存 ----------
// 后端对章节图片发了 ETag + 一周 max-age。原先每次渲染都往 URL 上拼 ?t=Date.now()，
// 键每次都不同，等于把这套缓存整个作废（翻一次筛选条件就把整章重新下载一遍）。
// 现在只在"服务端会换文件"时才换键：
//   原图用固定键 —— 解密/还原都不会动原图
//   解密图带章节版本号 —— 批量解密覆盖写入了新内容时才整章换一次键
const chapterRev = ref({})
const revOf = (id) => chapterRev.value[id] || 0
const bumpChapterRev = (id) => {
  if (id) chapterRev.value = { ...chapterRev.value, [id]: revOf(id) + 1 }
}

const getImageUrl = (img) => {
  const chapterId = currentChapter.value?.id
  if (!chapterId) return ''
  const base = comicApi.getImageUrl(chapterId, img.fileName)
  return img.isDecrypted ? `${base}?v=d${revOf(chapterId)}` : `${base}?v=o`
}

// 缩略图与查看器共用同一句 alt，读屏时两处说法一致
const pageLabel = (idx) =>
  `${comic.value?.name || '漫画'} ${currentChapter.value?.title || ''} 第 ${idx + 1} 页`

// ---------- 自动播放 ----------
const viewerPlaying = ref(false)
const viewerError = ref(false)
const playSpeed = ref(1000) // 毫秒，最小粒度 100ms
let playTimer = null

const viewerImage = computed(() => filteredImages.value[viewer.value.index] || null)
const viewerSrc = computed(() => (viewerImage.value ? getImageUrl(viewerImage.value) : ''))

const stopPlay = () => {
  if (playTimer) {
    clearTimeout(playTimer)
    playTimer = null
  }
  viewerPlaying.value = false
}

const schedulePlay = () => {
  if (!viewerPlaying.value) return
  const ms = Math.max(100, Number(playSpeed.value) || 1000)
  playTimer = setTimeout(() => {
    if (!viewerPlaying.value) return
    if (viewer.value.index < filteredImages.value.length - 1) {
      viewer.value.index++
      schedulePlay()
    } else {
      stopPlay()
    }
  }, ms)
}

const startPlay = () => {
  if (viewerPlaying.value || filteredImages.value.length === 0) return
  if (viewer.value.index >= filteredImages.value.length - 1) viewer.value.index = 0
  viewerPlaying.value = true
  schedulePlay()
}

const togglePlay = () => {
  if (viewerPlaying.value) stopPlay()
  else startPlay()
}

// ---------- 解密配置文本同步 ----------
const applyOrderText = () => {
  const nums = orderText.value
    .split(/[,\s]+/)
    .map(s => parseInt(s.trim(), 10))
    .filter(n => !isNaN(n) && n >= 0 && n < decryptConfig.value.rows)
  if (nums.length > 0) {
    decryptConfig.value.order = nums
    orderText.value = nums.join(',')
  }
}

const syncOrderLength = () => {
  const len = Math.max(2, decryptConfig.value.rows)
  decryptConfig.value.rows = len
  // 默认从大到小排列，例如 rows=3 → [2,1,0]
  decryptConfig.value.order = Array.from({ length: len }, (_, i) => len - 1 - i)
  orderText.value = decryptConfig.value.order.join(',')
}

// ---------- 加载 ----------
const loadComic = async () => {
  loading.value = true
  error.value = ''
  try {
    const res = await comicApi.getDetail(route.params.id)
    if (res.success) {
      comic.value = res.data.comic
      likeCount.value = res.data.comic?.likeCount || 0
      chapters.value = res.data.chapters || []
      if (chapters.value.length > 0 && !currentChapter.value) {
        selectChapter(chapters.value[0])
      }
    } else {
      error.value = res.message || '加载失败'
    }
  } catch (err) {
    console.error('加载漫画详情失败:', err)
    error.value = err.message || '加载失败'
  } finally {
    loading.value = false
  }
}

const selectChapter = async (ch) => {
  currentChapter.value = ch
  imageFilter.value = 'all'
  failedImages.value = new Set()
  closeViewer()
  try {
    const res = await comicApi.getChapterImages(ch.id)
    images.value = res.success ? (res.data.images || []) : []
  } catch {
    images.value = []
  }
}

const refreshImages = async () => {
  if (!currentChapter.value) return
  refreshing.value = true
  try {
    // 重新获取章节图片列表（后端会重新扫描目录）
    const res = await comicApi.getChapterImages(currentChapter.value.id)
    if (res.success) {
      images.value = res.data.images || []
      failedImages.value = new Set()
      // 用户主动要求重取，这才是唯一该换缓存键的场合
      bumpChapterRev(currentChapter.value.id)
    } else {
      ui.error(errText(res, '刷新失败'))
    }
  } catch (err) {
    ui.error('刷新失败：' + errText(err))
  } finally {
    refreshing.value = false
  }
}

// ---------- 章节操作 ----------
const openAddChapter = () => {
  editingChapter.value = null
  chapterForm.value = { title: '', directory: '', sortOrder: 0 }
  chapterDialog.value = 'add'
}

const openEditChapter = (ch) => {
  editingChapter.value = ch
  chapterForm.value = { title: ch.title || '', directory: ch.directory || '', sortOrder: ch.sortOrder || 0 }
  chapterDialog.value = 'edit'
}

const submitChapter = async () => {
  const isAdd = isAddChapter.value
  if (isAdd && !chapterForm.value.directory?.trim()) {
    ui.warn('章节目录不能为空')
    return
  }
  try {
    const res = isAdd
      ? await comicApi.addChapter(route.params.id, {
          title: chapterForm.value.title || undefined,
          directory: chapterForm.value.directory
        })
      : await comicApi.updateChapter(editingChapter.value.id, {
          title: chapterForm.value.title || undefined,
          directory: chapterForm.value.directory || undefined,
          sortOrder: chapterForm.value.sortOrder
        })
    if (res.success) {
      chapterDialog.value = ''
      if (isAdd) chapterForm.value = { title: '', directory: '', sortOrder: 0 }
      await loadComic()
      ui.success(isAdd ? '章节已添加' : '章节已更新')
    } else {
      ui.error(errText(res, isAdd ? '添加失败' : '更新失败'))
    }
  } catch (err) {
    ui.error((isAdd ? '添加章节失败：' : '更新章节失败：') + errText(err))
  }
}

const deleteChapter = async (ch) => {
  if (!await ui.confirm({
    title: '确认删除',
    message: `确定要删除章节「${ch.title}」吗？删除后不可恢复。`,
    danger: true
  })) return
  try {
    const res = await comicApi.deleteChapter(ch.id)
    if (res.success) {
      closeViewer()
      await loadComic()
      if (currentChapter.value?.id === ch.id) {
        currentChapter.value = chapters.value[0] || null
        if (currentChapter.value) await selectChapter(currentChapter.value)
        else images.value = []
      }
      ui.success('章节已删除')
    } else {
      ui.error(errText(res, '删除失败'))
    }
  } catch (err) {
    ui.error('删除章节失败：' + errText(err))
  }
}

// ---------- 解密 / 还原 ----------
// 只改 isDecrypted 状态，:src 与角标都会跟着重算；原先这里是 nextTick 里查 DOM 改 el.src
const decryptSingle = async (img) => {
  try {
    const res = await comicApi.decryptImage({
      chapterId: currentChapter.value.id,
      imageName: img.fileName,
      config: decryptConfig.value,
      overwrite: decryptConfig.value.overwrite
    })
    if (res.success) {
      img.isDecrypted = true
      ui.success('已解密')
    } else {
      ui.error(errText(res, '解密失败'))
    }
  } catch (err) {
    ui.error('解密失败：' + errText(err))
  }
}

const decryptAllImages = async () => {
  if (decrypting.value || !currentChapter.value) return
  const chapterId = currentChapter.value.id
  try {
    decrypting.value = true
    applyOrderText()
    const res = await comicApi.decryptBatch({
      chapterId,
      config: decryptConfig.value,
      overwrite: decryptConfig.value.overwrite
    })
    if (res.success) {
      const results = res.data.results || []
      // 后端逐条返回的是 fileName（原先按 imageName 取，永远匹配不上，整章状态纹丝不动）
      const done = new Set(results.filter(r => r.success).map(r => r.fileName))
      images.value.forEach(img => { if (done.has(img.fileName)) img.isDecrypted = true })
      // 覆盖写会重写已有解密图的内容，整章换键；未覆盖时新文件走 o→d 变体即可
      if (decryptConfig.value.overwrite) bumpChapterRev(chapterId)
      const successCount = results.filter(r => r.success).length
      const failedCount = results.length - successCount
      const summary = `解密完成：成功 ${successCount} 张，失败 ${failedCount} 张`
      // 有失败项时不能报成绿色成功，否则"失败 N 张"读起来像成功了
      if (failedCount > 0) ui.warn(summary)
      else ui.success(summary)
    } else {
      ui.error(errText(res, '解密失败'))
    }
  } catch (err) {
    ui.error('批量解密失败：' + errText(err))
  } finally {
    decrypting.value = false
  }
}

const restoreSingle = async (img) => {
  try {
    const res = await comicApi.restoreImage({
      chapterId: currentChapter.value.id,
      imageName: img.fileName
    })
    if (res.success) {
      img.isDecrypted = false
      ui.success('已还原')
    } else {
      ui.error(errText(res, '还原失败'))
    }
  } catch (err) {
    ui.error('还原失败：' + errText(err))
  }
}

const restoreAllImages = async () => {
  if (restoring.value || !currentChapter.value) return
  try {
    restoring.value = true
    const res = await comicApi.restoreBatch({ chapterId: currentChapter.value.id })
    if (res.success) {
      // 只删解密图，原图没动过，原图的缓存键可以继续用
      images.value.forEach(img => { img.isDecrypted = false })
      ui.success(errText(res, '还原完成'))
    } else {
      ui.error(errText(res, '还原失败'))
    }
  } catch (err) {
    ui.error('批量还原失败：' + errText(err))
  } finally {
    restoring.value = false
  }
}

const setAsCover = async (img) => {
  if (!currentChapter.value || !comic.value) return
  try {
    settingCover.value = true
    // 优先使用解密图路径
    const baseName = img.fileName.replace(/\.[^.]+$/, '')
    const decryptedPath = currentChapter.value.directory + '/_decrypted/' + baseName + '.jpg'
    const fullPath = img.isDecrypted ? decryptedPath : currentChapter.value.directory + '/' + img.fileName
    const res = await comicApi.update(comic.value.id, { ...comic.value, coverPath: fullPath })
    if (res.success) {
      comic.value.coverPath = fullPath
      ui.success('封面已设置')
    } else {
      ui.error(errText(res, '设置封面失败'))
    }
  } catch (err) {
    console.error('设置封面失败:', err)
    ui.error('设置封面失败：' + errText(err))
  } finally {
    settingCover.value = false
  }
}

// ---------- 查看器 ----------
const openViewer = (idx) => {
  stopPlay()
  viewerError.value = false
  viewer.value.show = true
  viewer.value.index = idx
}

const prevImage = () => { stopPlay(); if (viewer.value.index > 0) viewer.value.index-- }
const nextImage = () => {
  stopPlay()
  if (viewer.value.index < filteredImages.value.length - 1) viewer.value.index++
}
const closeViewer = () => { viewer.value.show = false; stopPlay() }

// ---------- 页面动作 ----------
const handleDelete = async () => {
  if (!await ui.confirm({
    title: '确认删除',
    message: '确定要删除这本漫画吗？删除后不可恢复。',
    danger: true
  })) return
  try {
    const res = await comicApi.delete(route.params.id)
    if (res.success) {
      router.push('/comics')
      ui.success('已删除')
    } else {
      ui.error(errText(res, '删除失败'))
    }
  } catch (err) {
    ui.error('删除失败：' + errText(err))
  }
}

const handleLike = async () => {
  if (likeDisabled.value) return
  likeDisabled.value = true
  try {
    const res = await comicApi.like(route.params.id)
    if (res.success) {
      likeCount.value = res.likeCount
    }
  } catch (err) {
    console.error('点赞失败:', err)
  } finally {
    setTimeout(() => { likeDisabled.value = false }, 3000)
  }
}

// 表单弹窗与列表页共用，回传的字段仍是漫画表单那一份
const handleUpdate = async (form) => {
  if (savingComic.value) return
  savingComic.value = true
  try {
    const res = await comicApi.update(route.params.id, {
      name: form.name,
      author: form.author || undefined,
      description: form.description || undefined,
      url: form.url || undefined,
      directory: form.directory || undefined,
      coverPath: form.coverPath || undefined,
      status: form.status
    })
    if (res.success) {
      showEdit.value = false
      await loadComic()
      ui.success('已保存')
    } else {
      ui.error(errText(res, '更新失败'))
    }
  } catch (err) {
    ui.error('更新失败：' + errText(err))
  } finally {
    savingComic.value = false
  }
}

// ---------- 查看器焦点归还（对话框那层由 Dialog 组件自己管） ----------
const viewerPanel = ref(null)
let viewerOpener = null

watch(() => viewer.value.show, (open) => {
  if (open) {
    viewerOpener = document.activeElement
    nextTick(() => viewerPanel.value?.focus?.())
  } else {
    viewerOpener?.focus?.()
    viewerOpener = null
  }
})

// ---------- 键盘快捷键 ----------
const handleKeydown = (e) => {
  if (!viewer.value.show) return
  // 焦点在间隔输入框里时，方向键与空格归它自己用，别抢去翻页
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName)) {
    if (e.key === 'Escape') closeViewer()
    return
  }
  if (e.key === 'ArrowLeft') prevImage()
  else if (e.key === 'ArrowRight') nextImage()
  else if (e.key === 'Escape') closeViewer()
  else if (e.key === ' ' || e.code === 'Space') { e.preventDefault(); togglePlay() }
}

// 筛选或删改导致图片变少时，查看器索引要跟上
watch(() => filteredImages.value.length, (len) => {
  if (!viewer.value.show) return
  if (len === 0) closeViewer()
  else if (viewer.value.index > len - 1) viewer.value.index = len - 1
})

// 查看器内换图或图片被重新解密时，重新给 <img> 一次机会
watch(viewerSrc, () => { viewerError.value = false })

onMounted(() => {
  loadComic()
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
  stopPlay()
})
</script>

<style scoped>
/* 表面、按钮、表单、遮罩全部走 main.css 令牌，这里只留本页面特有的排布 */

/* ---------- 头部 ---------- */
.comic-detail {
  display: flex;
  flex-direction: column;
  gap: var(--s4);
}

.comic-title {
  flex: 1;
  min-width: 0;
  gap: var(--s2);
}

.comic-name {
  max-width: 42ch;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.author {
  font-size: var(--f-sm);
  font-weight: 400;
  color: var(--text-dim);
  white-space: nowrap;
}

.header-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s2);
}

.like-btn {
  color: var(--like);
  border-color: var(--like-soft);
}

.like-btn:hover:not(:disabled) {
  background: var(--like-soft);
  border-color: var(--like);
  color: var(--like);
}

/* ---------- 基本信息 ---------- */
.comic-info {
  display: flex;
  flex-direction: column;
  gap: var(--s2);
}

.info-row {
  display: flex;
  align-items: flex-start;
  gap: var(--s3);
}

.info-row .label {
  flex: 0 0 40px;
  color: var(--text-dim);
}

.info-row .value {
  min-width: 0;
  word-break: break-all;
}

/* 目录路径用等宽字，和简介区分开 */
.info-row .value.path {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: var(--f-sm);
  color: var(--text-dim);
}

.link {
  color: var(--accent);
}

.link:hover {
  text-decoration: underline;
}

/* ---------- 主区域与章节标签栏 ---------- */
.main-area,
.viewer-section {
  display: flex;
  flex-direction: column;
  gap: var(--s3);
}

/* ---------- 章节标签栏 ---------- */
.chapter-tabs {
  display: flex;
  gap: var(--s2);
  overflow-x: auto;
  padding-bottom: var(--s1);
}

.chapter-tab {
  position: relative;
  flex: 0 0 auto;
  display: flex;
  border: 1px solid var(--border);
  border-radius: var(--r2);
  background: var(--bg-elev);
  transition: border-color var(--dur) var(--ease), background var(--dur) var(--ease),
    color var(--dur) var(--ease);
}

.chapter-tab:hover {
  border-color: var(--border-strong);
  background: var(--bg-elev-2);
}

.chapter-tab.active {
  border-color: var(--accent);
  background: var(--accent-soft);
  color: var(--accent);
}

.tab-main {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  min-width: 120px;
  padding: var(--s2) var(--s3);
  color: inherit;
  border-radius: inherit;
}

.tab-title {
  max-width: 100px;
  font-size: var(--f-sm);
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 计数跟着标签主色走，激活态不必再覆写一次 */
.tab-count {
  font-size: var(--f-xs);
  color: inherit;
  opacity: .65;
}

.tab-actions {
  position: absolute;
  top: 2px;
  right: 2px;
  display: flex;
  gap: 2px;
}

.tab-action {
  display: grid;
  place-items: center;
  width: 18px;
  height: 18px;
  border-radius: var(--r1);
  background: var(--bg-hover);
  color: var(--text-dim);
  font-size: var(--f-xs);
  line-height: 1;
  transition: background var(--dur) var(--ease), color var(--dur) var(--ease);
}

.tab-action:hover {
  background: var(--accent);
  color: var(--accent-ink);
}

.tab-action-danger:hover {
  background: var(--danger);
  color: #fff;
}

/* ---------- 解密工具栏 ---------- */
.decrypt-toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--s3);
  padding: var(--s3);
  font-size: var(--f-sm);
}

/* 漂浮模式：钉在右侧，方便一边翻页一边调参数 */
.decrypt-toolbar.floating {
  position: fixed;
  right: var(--s4);
  top: 50%;
  transform: translateY(-50%);
  z-index: var(--z-fab);
  flex-direction: column;
  align-items: stretch;
  flex-wrap: nowrap;
  gap: var(--s2);
  width: 200px;
  box-shadow: var(--shadow-3);
}

.decrypt-group {
  display: flex;
  align-items: center;
  gap: var(--s2);
  min-width: 0;
  white-space: nowrap;
}

.decrypt-toolbar.floating .decrypt-group {
  flex-direction: column;
  align-items: flex-start;
  gap: var(--s1);
}

.decrypt-toolbar.floating .input,
.decrypt-toolbar.floating .btn {
  width: 100%;
}

.group-label {
  color: var(--text-dim);
}

.group-hint {
  font-size: var(--f-xs);
  color: var(--text-faint);
}

.input.num,
.order-text {
  width: 62px;
  padding: 5px 8px;
}

.order-text {
  width: 150px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

.decrypt-actions {
  display: flex;
  align-items: center;
  gap: var(--s2);
  margin-left: auto;
}

.decrypt-toolbar.floating .decrypt-actions {
  flex-direction: column;
  align-items: stretch;
  margin-left: 0;
}

.check {
  display: flex;
  align-items: center;
  gap: var(--s2);
  font-size: var(--f-sm);
  color: var(--text-dim);
  white-space: nowrap;
  cursor: pointer;
}

.check input {
  accent-color: var(--accent);
  cursor: pointer;
}

/* ---------- 图片工具栏 ---------- */
.image-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--s3);
  flex-wrap: wrap;
}

.chapter-badge {
  display: flex;
  align-items: center;
  gap: var(--s2);
  min-width: 0;
}

.chapter-name {
  font-size: var(--f-md);
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.image-toolbar-filter {
  display: flex;
  align-items: center;
  gap: var(--s3);
}

/* ---------- 图片网格：原先是 repeat(5, 1fr) 的明信片墙，这里只换成自适应列 ---------- */
.image-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(148px, 1fr));
  gap: var(--s3);
}

.image-item {
  display: flex;
  flex-direction: column;
  gap: var(--s2);
  cursor: pointer;
}

.tile-cover {
  aspect-ratio: var(--ratio-poster);
  border: 1px solid var(--border);
  border-radius: var(--r1);
  overflow: hidden;
  transition: transform var(--dur) var(--ease), border-color var(--dur) var(--ease),
    box-shadow var(--dur) var(--ease);
}

.image-item:hover .tile-cover {
  transform: translateY(-2px);
  border-color: var(--border-strong);
  box-shadow: var(--shadow-2);
}

.tile-cover.is-decrypted {
  border-color: var(--success);
}

.img-badge {
  position: absolute;
  top: var(--s1);
  right: var(--s1);
  min-width: 20px;
  padding: 1px 6px;
  border-radius: var(--rp);
  font-size: var(--f-xs);
  line-height: 1.5;
  text-align: center;
  color: #fff;
  font-variant-numeric: tabular-nums;
}

.badge-decrypted {
  background: var(--success);
}

.badge-index {
  top: auto;
  bottom: var(--s1);
  background: rgba(8, 10, 14, .68);
}

.image-actions {
  display: flex;
  justify-content: center;
  gap: var(--s1);
}

/* ---------- 查看器：借 .overlay 的定位与淡入，只把它压得更黑、层级抬到灯箱 ---------- */
.viewer {
  z-index: var(--z-lightbox);
  background: rgba(6, 8, 11, .95);
}

.viewer__close,
.viewer__nav {
  position: absolute;
  display: grid;
  place-items: center;
  border-radius: var(--r2);
  background: rgba(255, 255, 255, .12);
  color: #fff;
  line-height: 1;
  transition: background var(--dur) var(--ease);
}

.viewer__close:hover,
.viewer__nav:hover:not(:disabled) {
  background: rgba(255, 255, 255, .26);
}

.viewer__close {
  top: var(--s4);
  right: var(--s4);
  width: 44px;
  height: 44px;
  font-size: var(--f-2xl);
}

.viewer__nav {
  top: 50%;
  transform: translateY(-50%);
  padding: var(--s4) var(--s3);
  font-size: var(--f-xl);
}

.viewer__prev { left: var(--s4); }
.viewer__next { right: var(--s4); }

.viewer__nav:disabled {
  opacity: .3;
  cursor: not-allowed;
}

.viewer__stage {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--s2);
  max-width: 90vw;
}

.viewer__stage img {
  max-width: 100%;
  max-height: calc(92vh - 88px);
  object-fit: contain;
  border-radius: var(--r1);
}

.viewer__info,
.viewer__controls {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: var(--s2);
  color: rgba(255, 255, 255, .8);
}

.viewer__count {
  font-variant-numeric: tabular-nums;
}

.viewer__name {
  color: rgba(255, 255, 255, .45);
  font-size: var(--f-xs);
}

.viewer__error {
  color: var(--danger);
  font-size: var(--f-sm);
}

/* 深色底上的控件不跟随主题，亮色主题下也保持可读 */
.viewer__controls .btn {
  background: rgba(255, 255, 255, .12);
  border-color: transparent;
  color: #fff;
}

.viewer__controls .btn:hover {
  background: rgba(255, 255, 255, .26);
  border-color: transparent;
  color: #fff;
}

.speed-control {
  display: flex;
  align-items: center;
  gap: var(--s1);
  font-size: var(--f-xs);
}

.speed-input {
  width: 62px;
  padding: 3px 6px;
  border: 1px solid rgba(255, 255, 255, .3);
  border-radius: var(--r1);
  background: rgba(0, 0, 0, .35);
  color: #fff;
  font-size: var(--f-xs);
  text-align: center;
}

.speed-input:focus {
  border-color: var(--accent);
}

.speed-presets {
  display: flex;
  gap: 3px;
}

.speed-preset {
  padding: 3px 7px;
  border: 1px solid rgba(255, 255, 255, .3);
  border-radius: var(--r1);
  color: rgba(255, 255, 255, .85);
  font-size: var(--f-xs);
  transition: background var(--dur) var(--ease), color var(--dur) var(--ease);
}

.speed-preset:hover {
  background: rgba(255, 255, 255, .15);
}

.speed-preset.active {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--accent-ink);
}

/* ---------- 章节表单：外观走 main.css 的 .dialog/.field/.input ---------- */
.chapter-form {
  display: flex;
  flex-direction: column;
  gap: var(--s3);
}

.required {
  color: var(--danger);
}

.form-hint {
  font-size: var(--f-xs);
  color: var(--text-faint);
}

@media (max-width: 768px) {
  .image-grid {
    grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
  }

  .decrypt-actions {
    margin-left: 0;
  }
}
</style>
