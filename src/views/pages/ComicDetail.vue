<template>
  <div class="comic-detail" v-if="comic">
    <!-- 头部 -->
    <div class="detail-header">
      <button class="back-btn" @click="$router.back()">← 返回</button>
      <div class="comic-title">
        <h1>{{ comic.name }} <span v-if="comic.status === 1" class="badge-completed">完结</span></h1>
        <span class="author" v-if="comic.author">作者：{{ comic.author }}</span>
      </div>
      <div class="header-actions">
        <button class="action-btn like-btn" @click="handleLike" :disabled="likeDisabled">
          <span>点赞</span>
        </button>
        <button v-if="!isCompleted" class="btn" @click="refreshImages" :disabled="refreshing" title="重新加载章节图片，清除浏览器缓存">{{ refreshing ? '刷新中...' : '🔄 刷新' }}</button>
        <button v-if="!isCompleted" class="btn btn-primary" @click="showEdit = true">编辑</button>
        <button v-if="!isCompleted" class="btn btn-danger" @click="handleDelete">删除</button>
      </div>
    </div>

    <!-- 基本信息 -->
    <div class="comic-info" v-if="comic.description || comic.url || comic.directory">
      <div class="info-row" v-if="comic.description">
        <span class="label">简介</span>
        <span class="value">{{ comic.description }}</span>
      </div>
      <div class="info-row" v-if="comic.url">
        <span class="label">链接</span>
        <a :href="comic.url" target="_blank" class="value link">{{ comic.url }}</a>
      </div>
      <div class="info-row" v-if="comic.directory">
        <span class="label">目录</span>
        <span class="value">{{ comic.directory }}</span>
      </div>
    </div>

    <!-- 章节标签 + 图片区 -->
    <div class="main-area">
      <!-- 添加章节按钮（独立一行） -->
      <div class="chapter-add-row" v-if="!isCompleted">
        <button class="btn btn-primary btn-sm" @click="showAddChapter = true">+ 添加章节</button>
      </div>

      <!-- 章节标签栏 -->
      <div class="chapter-tabs">
        <div class="chapter-tabs-inner">
          <button
            v-for="ch in chapters"
            :key="ch.id"
            class="chapter-tab"
            :class="{ active: currentChapter?.id === ch.id }"
            @click="selectChapter(ch)"
            :title="ch.title"
          >
            <span class="tab-title">{{ ch.title }}</span>
            <span class="tab-count">{{ ch.imageCount }} 图</span>
            <div class="tab-actions" v-if="!isCompleted" @click.stop>
              <button class="tab-action" title="编辑" @click.stop="openEditChapter(ch)">✎</button>
              <button class="tab-action tab-action-danger" title="删除" @click.stop="deleteChapter(ch)">✕</button>
            </div>
          </button>
        </div>
      </div>

      <!-- 无章节提示 -->
      <div class="no-chapter-hint" v-if="chapters.length === 0">
        暂无章节， 点击上方"+ 添加章节"按钮新增
      </div>

      <!-- 无选中章节提示 -->
      <div class="no-chapter-hint" v-if="chapters.length > 0 && !currentChapter">
        请选择一个章节
      </div>

      <!-- 图片区 -->
      <div class="viewer-section" v-if="currentChapter">
        <!-- 解密工具栏 -->
        <div v-if="!isCompleted" class="decrypt-toolbar" :class="{ floating: floatMode }">
          <div class="decrypt-group">
            <span class="group-label">切割行数</span>
            <input
              v-model.number="decryptConfig.rows"
              type="number"
              min="2"
              class="decrypt-input"
              @change="syncOrderLength"
            />
          </div>

          <div class="decrypt-group">
            <span class="group-label">顶部留高</span>
            <input
              v-model.number="decryptConfig.topPadding"
              type="number"
              min="0"
              class="decrypt-input"
              placeholder="0"
            />
          </div>

          <div class="decrypt-group">
            <span class="group-label">底部留高</span>
            <input
              v-model.number="decryptConfig.bottomPadding"
              type="number"
              min="0"
              class="decrypt-input"
              placeholder="0"
            />
          </div>

          <div class="decrypt-group">
            <span class="group-label">排列顺序</span>
            <input
              v-model="orderText"
              type="text"
              class="decrypt-input order-text"
              placeholder="如 2,1,0"
              @blur="applyOrderText"
            />
            <small class="group-hint">{{ decryptConfig.rows }} 个 0~{{ decryptConfig.rows - 1 }} 的整数</small>
          </div>

          <label class="decrypt-group overwrite-check">
            <input type="checkbox" v-model="decryptConfig.overwrite" />
            <span>覆盖已解密</span>
          </label>

          <button
            class="btn btn-warning"
            @click="decryptAllImages"
            :disabled="decrypting"
          >
            {{ decrypting ? '解密中…' : '批量解密' }}
          </button>
          <button
            v-if="hasDecrypted"
            class="btn"
            @click="restoreAllImages"
            :disabled="restoring"
          >
            {{ restoring ? '还原中…' : '批量还原' }}
          </button>
          <button class="btn btn-sm float-toggle" @click="floatMode = !floatMode" :title="floatMode ? '取消漂浮' : '漂浮模式'">
            {{ floatMode ? '📌' : '📍' }}
          </button>
        </div>

        <!-- 图片网格 -->
        <div class="image-toolbar">
          <div class="chapter-badge">
            <span class="chapter-name">{{ currentChapter.title }}</span>
            <span class="chapter-img-count">{{ filteredImages.length }} 图</span>
          </div>
          <div v-if="!isCompleted" class="image-toolbar-filter">
            <label class="show-decrypted-check">
              <input type="checkbox" v-model="showDecryptedOnly" />
              <span>仅显示已解密</span>
            </label>
            <label class="show-decrypted-check">
              <input type="checkbox" v-model="showUndecryptedOnly" />
              <span>仅显示未解密</span>
            </label>
          </div>
        </div>

        <div class="image-grid">
          <div
            v-for="(img, idx) in filteredImages"
            :key="img.fileName"
            class="image-item"
            :data-filename="img.fileName"
            @click="openViewer(idx)"
          >
            <div class="cover-wrapper">
              <img
                :src="getImageUrl(img)"
                :class="{ decrypted: img.isDecrypted }"
                @error="e => e.target.style.display = 'none'"
                loading="lazy"
              />
              <div class="img-badge badge-decrypted" v-if="img.isDecrypted">✓</div>
              <div class="img-badge badge-index">{{ idx + 1 }}</div>
            </div>
            <div class="image-actions" v-if="!isCompleted">
              <button v-if="!img.isDecrypted" class="btn btn-xs" @click.stop="decryptSingle(img)">解密</button>
              <button v-else class="btn btn-xs btn-warning" @click.stop="restoreSingle(img)">还原</button>
              <button v-if="!comic.coverPath" class="btn btn-xs" @click.stop="setAsCover(img)" :disabled="settingCover">设为封面</button>
            </div>
          </div>

          <div v-if="filteredImages.length === 0" class="empty-images">
            <span>{{ '该章节暂无图片' }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 图片查看器弹窗 -->
    <div class="viewer-modal" v-if="viewer.show" @click.self="closeViewer">
      <button class="viewer-close" @click="closeViewer">×</button>
      <button class="viewer-prev" @click="prevImage" :disabled="viewer.index <= 0">◀</button>
      <div class="viewer-content">
        <img
          :src="viewer.currentSrc"
          @error="handleViewerImgError"
          alt="漫画图片"
        />
        <div class="viewer-info">
          {{ viewer.index + 1 }} / {{ filteredImages.length }}
          <span v-if="viewer.currentDecrypted"> ✓ 已解密</span>
        </div>
        <div class="viewer-controls">
          <button class="viewer-play-btn" @click="togglePlay" :title="viewerPlaying ? '暂停' : '播放'">
            {{ viewerPlaying ? '暂停' : '播放' }}
          </button>
          <div class="speed-control">
            <span class="speed-label">间隔</span>
            <input
              v-model.number="playSpeed"
              type="number"
              min="100"
              max="10000"
              step="100"
              class="speed-input"
            />
            <span class="speed-unit">ms</span>
            <div class="speed-presets">
              <button
                v-for="s in [300, 500, 1000, 2000]"
                :key="s"
                class="speed-preset"
                :class="{ active: playSpeed === s }"
                @click="playSpeed = s"
              >{{ s }}</button>
            </div>
          </div>
        </div>
      </div>
      <button class="viewer-next" @click="nextImage" :disabled="viewer.index >= filteredImages.length - 1">▶</button>
    </div>

    <!-- 添加章节对话框 -->
    <Dialog :visible="showAddChapter" title="添加章节" @cancel="showAddChapter = false" @confirm="handleAddChapter">
      <template #content>
        <div class="form-group">
          <label>章节标题</label>
          <input v-model="chapterForm.title" type="text" placeholder="默认为目录名" />
        </div>
        <div class="form-group">
          <label>章节目录 <span class="required">*</span></label>
          <input v-model="chapterForm.directory" type="text" placeholder="章节图片所在目录的完整路径" />
          <small>填写漫画章节图片所在文件夹的完整路径</small>
        </div>
      </template>
      <template #actions>
        <button class="btn" @click="showAddChapter = false">取消</button>
        <button class="btn btn-primary" @click="handleAddChapter">添加</button>
      </template>
    </Dialog>

    <!-- 编辑章节对话框 -->
    <Dialog :visible="showEditChapter" title="编辑章节" @cancel="showEditChapter = false" @confirm="handleUpdateChapter">
      <template #content>
        <div class="form-group">
          <label>章节标题</label>
          <input v-model="editChapterForm.title" type="text" placeholder="章节标题" />
        </div>
        <div class="form-group">
          <label>章节目录</label>
          <input v-model="editChapterForm.directory" type="text" placeholder="章节图片所在目录的完整路径" />
          <small>修改后若目录不同，将重新统计图片数量</small>
        </div>
        <div class="form-group">
          <label>排序号</label>
          <input v-model.number="editChapterForm.sortOrder" type="number" min="0" placeholder="数字越小越靠前" />
        </div>
      </template>
      <template #actions>
        <button class="btn" @click="showEditChapter = false">取消</button>
        <button class="btn btn-primary" @click="handleUpdateChapter">保存</button>
      </template>
    </Dialog>

    <!-- 编辑漫画对话框 -->
    <Dialog :visible="showEdit" title="编辑漫画" @cancel="showEdit = false" @confirm="handleUpdate">
      <template #content>
        <div class="form-group">
          <label>名称 <span class="required">*</span></label>
          <input v-model="editForm.name" type="text" />
        </div>
        <div class="form-group">
          <label>作者</label>
          <input v-model="editForm.author" type="text" />
        </div>
        <div class="form-group">
          <label>简介</label>
          <textarea v-model="editForm.description" rows="3" style="resize:none"></textarea>
        </div>
        <div class="form-group">
          <label>链接</label>
          <input v-model="editForm.url" type="text" />
        </div>
        <div class="form-group">
          <label>目录</label>
          <input v-model="editForm.directory" type="text" />
        </div>
        <div class="form-group">
          <label>状态</label>
          <select v-model.number="editForm.status">
            <option :value="0">连载中</option>
            <option :value="1">完结</option>
          </select>
        </div>
      </template>
      <template #actions>
        <button class="btn" @click="showEdit = false">取消</button>
        <button class="btn btn-primary" @click="handleUpdate">保存</button>
      </template>
    </Dialog>

  </div>

  <div class="loading" v-else-if="loading">加载中…</div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { comicApi } from '@/scripts/api'
import Dialog from '@/views/components/Dialog.vue'

const route = useRoute()
const router = useRouter()

const comic = ref(null)
const chapters = ref([])
const currentChapter = ref(null)
const loading = ref(false)
const showEdit = ref(false)
const showAddChapter = ref(false)
const showEditChapter = ref(false)
const editingChapter = ref(null)
const showDecryptedOnly = ref(false)
const showUndecryptedOnly = ref(false)
const displayImages = ref([])  // 实际显示的图片列表，切换筛选/章节时才重新筛选

const editChapterForm = ref({ title: '', directory: '', sortOrder: 0 })
const editForm = ref({ name: '', author: '', description: '', url: '', directory: '', status: 0 })
const chapterForm = ref({ title: '', directory: '' })
const images = ref([])

const decryptConfig = ref({ rows: 3, order: [2, 1, 0], overwrite: true, topPadding: 0, bottomPadding: 0 })
const orderText = ref('2,1,0')        // 文本形式绑定
const decrypting = ref(false)
const refreshing = ref(false)
const restoring = ref(false)
const settingCover = ref(false)
const floatMode = ref(false)
const likeCount = ref(0)
const likeDisabled = ref(false)

const viewer = ref({ show: false, index: 0, currentSrc: '', currentDecrypted: false })

// ---------- 自动播放 ----------
const viewerPlaying = ref(false)
const playSpeed = ref(1000) // 毫秒，最小粒度 100ms
let playTimer = null

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
      updateViewerImage()
      schedulePlay()
    } else {
      stopPlay()
    }
  }, ms)
}

const startPlay = () => {
  if (viewerPlaying.value || filteredImages.value.length === 0) return
  if (viewer.value.index >= filteredImages.value.length - 1) {
    viewer.value.index = 0
    updateViewerImage()
  }
  viewerPlaying.value = true
  schedulePlay()
}

const togglePlay = () => {
  viewerPlaying.value ? stopPlay() : startPlay()
}


const applyFilter = () => {
  if (showDecryptedOnly.value) {
    displayImages.value = images.value.filter(img => img.isDecrypted)
  } else if (showUndecryptedOnly.value) {
    displayImages.value = images.value.filter(img => !img.isDecrypted)
  } else {
    displayImages.value = [...images.value]
  }
}

const filteredImages = computed(() => displayImages.value)

const hasDecrypted = computed(() => images.value.some(img => img.isDecrypted))
const isCompleted = computed(() => comic.value?.status === 1)

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
  try {
    const res = await comicApi.getDetail(route.params.id)
    if (res.success) {
      comic.value = res.data.comic
      likeCount.value = res.data.comic?.likeCount || 0
      chapters.value = res.data.chapters || []
      if (chapters.value.length > 0 && !currentChapter.value) {
        selectChapter(chapters.value[0])
      }
    }
  } catch (error) {
    alert('加载失败：' + (error.message || error))
  } finally {
    loading.value = false
  }
}

const selectChapter = async (ch) => {
  currentChapter.value = ch
  showDecryptedOnly.value = false
  showUndecryptedOnly.value = false
  viewer.value.show = false
  try {
    const res = await comicApi.getChapterImages(ch.id)
    if (res.success) {
      images.value = res.data.images || []
      applyFilter()
    }
  } catch {
    images.value = []
    applyFilter()
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
      applyFilter()
      // 强制刷新所有图片 src（带新时间戳）
      nextTick(() => {
        document.querySelectorAll('.image-item img').forEach(el => {
          const src = el.src.split('?')[0]
          el.src = src + '?t=' + Date.now()
        })
      })
    }
  } catch (error) {
    alert('刷新失败：' + (error.message || error))
  } finally {
    refreshing.value = false
  }
}

// ---------- 章节操作 ----------
const openEditChapter = (ch) => {
  editingChapter.value = ch
  editChapterForm.value = { title: ch.title || '', directory: ch.directory || '', sortOrder: ch.sortOrder || 0 }
  showEditChapter.value = true
}

const handleUpdateChapter = async () => {
  try {
    const res = await comicApi.updateChapter(editingChapter.value.id, {
      title: editChapterForm.value.title || undefined,
      directory: editChapterForm.value.directory || undefined,
      sortOrder: editChapterForm.value.sortOrder
    })
    if (res.success) {
      showEditChapter.value = false
      await loadComic()
    } else {
      alert(res.message || '更新失败')
    }
  } catch (error) {
    alert('更新章节失败：' + (error.message || error))
  }
}

const handleAddChapter = async () => {
  if (!chapterForm.value.directory?.trim()) {
    alert('章节目录不能为空')
    return
  }
  try {
    const res = await comicApi.addChapter(route.params.id, {
      title: chapterForm.value.title || undefined,
      directory: chapterForm.value.directory
    })
    if (res.success) {
      showAddChapter.value = false
      chapterForm.value = { title: '', directory: '' }
      await loadComic()
    } else {
      alert(res.message || '添加失败')
    }
  } catch (error) {
    alert('添加章节失败：' + (error.message || error))
  }
}

const deleteChapter = async (ch) => {
  if (!confirm(`确定要删除章节「${ch.title}」吗？`)) return
  try {
    const res = await comicApi.deleteChapter(ch.id)
    if (res.success) {
      await loadComic()
      if (currentChapter.value?.id === ch.id) {
        currentChapter.value = chapters.value[0] || null
        if (currentChapter.value) await selectChapter(currentChapter.value)
        else images.value = []
      }
    } else {
      alert(res.message || '删除失败')
    }
  } catch (error) {
    alert('删除章节失败：' + (error.message || error))
  }
}

// ---------- 解密 ----------
const getImageUrl = (img) => {
  const base = comicApi.getImageUrl(currentChapter.value.id, img.fileName)
  const sep = base.includes('?') ? '&' : '?'
  if (img.isDecrypted) {
    return base + sep + 'decrypted=1&t=' + Date.now()
  }
  return base + sep + 't=' + Date.now()
}

const refreshImage = (img) => {
  img.isDecrypted = true
  nextTick(() => {
    const el = document.querySelector(`.image-item[data-filename="${img.fileName}"] img`)
    if (el) el.src = getImageUrl(img)
  })
}

const restoreImageDisplay = (img) => {
  img.isDecrypted = false
  nextTick(() => {
    const el = document.querySelector(`.image-item[data-filename="${img.fileName}"] img`)
    if (el) {
      const base = comicApi.getImageUrl(currentChapter.value.id, img.fileName)
      el.src = base + '?t=' + Date.now()
    }
  })
}

const decryptSingle = async (img) => {
  try {
    const res = await comicApi.decryptImage({
      chapterId: currentChapter.value.id,
      imageName: img.fileName,
      config: decryptConfig.value,
      overwrite: decryptConfig.value.overwrite
    })
    if (res.success) {
      refreshImage(img)
    } else {
      alert(res.message || '解密失败')
    }
  } catch (error) {
    alert('解密失败：' + (error.message || error))
  }
}

const decryptAllImages = async () => {
  if (decrypting.value || !currentChapter.value) return
  try {
    decrypting.value = true
    applyOrderText()
    const res = await comicApi.decryptBatch({
      chapterId: currentChapter.value.id,
      config: decryptConfig.value,
      overwrite: decryptConfig.value.overwrite
    })
    if (res.success) {
      const successCount = res.data.results.filter(r => r.success).length
      filteredImages.value.forEach(img => {
        if (res.data.results.some(r => r.success && r.imageName === img.fileName)) {
          refreshImage(img)
        }
      })
      alert(`解密完成：成功 ${successCount} 张，失败 ${res.data.results.length - successCount} 张`)
    } else {
      alert(res.message || '解密失败')
    }
  } catch (error) {
    alert('批量解密失败：' + (error.message || error))
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
      restoreImageDisplay(img)
    } else {
      alert(res.message || '还原失败')
    }
  } catch (error) {
    alert('还原失败：' + (error.message || error))
  }
}

const restoreAllImages = async () => {
  if (restoring.value || !currentChapter.value) return
  try {
    restoring.value = true
    const res = await comicApi.restoreBatch({ chapterId: currentChapter.value.id })
    if (res.success) {
      images.value.forEach(img => { img.isDecrypted = false })
      nextTick(() => {
        document.querySelectorAll('.image-item img').forEach(el => {
          const src = el.src.split('?')[0]
          el.src = src + '?t=' + Date.now()
        })
      })
      alert(res.message || '还原完成')
    } else {
      alert(res.message || '还原失败')
    }
  } catch (error) {
    alert('批量还原失败：' + (error.message || error))
  } finally {
    restoring.value = false
  }
}

// ---------- 查看器 ----------

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
    }
  } catch (error) {
    console.error('设置封面失败:', error)
  } finally {
    settingCover.value = false
  }
}

// ---------- 查看器 ----------
const openViewer = (idx) => {
  stopPlay()
  const img = filteredImages.value[idx]
  viewer.value = {
    show: true, index: idx,
    currentSrc: getImageUrl(img),
    currentDecrypted: img.isDecrypted
  }
}

const updateViewerImage = () => {
  const img = filteredImages.value[viewer.value.index]
  if (!img) return
  viewer.value.currentSrc = getImageUrl(img)
  viewer.value.currentDecrypted = img.isDecrypted
}

const prevImage = () => { stopPlay(); if (viewer.value.index > 0) { viewer.value.index--; updateViewerImage() } }
const nextImage = () => { stopPlay(); if (viewer.value.index < filteredImages.value.length - 1) { viewer.value.index++; updateViewerImage() } }
const closeViewer = () => { viewer.value.show = false; stopPlay() }
const handleViewerImgError = (e) => { e.target.style.display = 'none' }

const handleDelete = async () => {
  if (!confirm('确定要删除这本漫画吗？')) return
  try {
    const res = await comicApi.delete(route.params.id)
    if (res.success) router.push('/comics')
    else alert(res.message || '删除失败')
  } catch (error) {
    alert('删除失败：' + (error.message || error))
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
  } catch (error) {
    console.error('点赞失败:', error)
  } finally {
    setTimeout(() => { likeDisabled.value = false }, 3000)
  }
}

const handleUpdate = async () => {
  try {
    const res = await comicApi.update(route.params.id, {
      name: editForm.value.name,
      author: editForm.value.author || undefined,
      description: editForm.value.description || undefined,
      url: editForm.value.url || undefined,
      directory: editForm.value.directory || undefined,
      coverPath: comic.value.coverPath || undefined,
      status: editForm.value.status
    })
    if (res.success) {
      showEdit.value = false
      await loadComic()
    } else {
      alert(res.message || '更新失败')
    }
  } catch (error) {
    alert('更新失败：' + (error.message || error))
  }
}

// ---------- 键盘快捷键 ----------
const handleKeydown = (e) => {
  if (!viewer.value.show) return
  if (e.key === 'ArrowLeft') prevImage()
  else if (e.key === 'ArrowRight') nextImage()
  else if (e.key === 'Escape') closeViewer()
  else if (e.key === ' ' || e.code === 'Space') { e.preventDefault(); togglePlay() }
}

// ---------- 编辑漫画弹窗预填 ----------
watch(showEdit, (val) => {
  if (val) {
    editForm.value = {
      name: comic.value?.name || '',
      author: comic.value?.author || '',
      description: comic.value?.description || '',
      url: comic.value?.url || '',
      directory: comic.value?.directory || '',
      status: comic.value?.status || 0
    }
  }
})

// 切换筛选项时重新筛选
watch([showDecryptedOnly, showUndecryptedOnly], () => {
  applyFilter()
})

// 关闭查看器时停止播放
watch(() => viewer.value.show, (v) => {
  if (!v) stopPlay()
})

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
/* ---------- 整体布局 ---------- */
.comic-detail {
  max-width: 1400px;
  margin: 0 auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.loading {
  text-align: center;
  color: #999;
  font-size: 16px;
  padding: 60px;
}

/* ---------- 头部 ---------- */
.detail-header {
  display: flex;
  align-items: center;
  gap: 16px;
  border-bottom: 1px solid #eee;
}

.back-btn {
  padding: 8px 16px;
  background: #f5f5f5;
  border: 1px solid #ddd;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  color: #333;
  flex-shrink: 0;
}
.back-btn:hover { background: #eee; }

.comic-title {
  flex: 1;
  display: flex;
  align-items: baseline;
  gap: 12px;
  min-width: 0;
}
.comic-title h1 { margin: 0; font-size: 24px; color: #333; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: flex; align-items: center; gap: 6px; }

.badge-completed {
  display: inline-block;
  padding: 2px 8px;
  font-size: 13px;
  font-weight: bold;
  color: #fff;
  background: #e74c3c;
  border-radius: 4px;
  flex-shrink: 0;
}
.author { font-size: 14px; color: #888; white-space: nowrap; flex-shrink: 0; }

.header-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
  align-items: center;
}

.action-btn {
  height: 32px;
  padding: 0 12px;
  display: flex;
  justify-content: center;
  align-items: center;
  border: 1px solid #ddd;
  border-radius: 8px;
  background: #fff;
  cursor: pointer;
  font-size: 13px;
  color: #333;
  transition: all 0.2s;
}

.action-btn:hover {
  border-color: #3498db;
  color: #3498db;
  background: #f0f8ff;
}

.action-btn.like-btn {
  border-color: #e74c3c;
  color: #e74c3c;
}

.action-btn.like-btn:hover {
  background: #fdf2f2;
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ---------- 基本信息 ---------- */
.comic-info {
  background: #f9f9f9;
  border-radius: 8px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.info-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  font-size: 14px;
}

.label {
  color: #888;
  font-weight: 500;
  white-space: nowrap;
  flex-shrink: 0;
  min-width: 40px;
}

.value { color: #333; word-break: break-all; }
.link { color: #3498db; text-decoration: none; }
.link:hover { text-decoration: underline; }

/* ---------- 主区域 ---------- */
.main-area {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* ---------- 章节标签栏 ---------- */
.chapter-tabs {
  display: flex;
  align-items: center;
  gap: 8px;
  overflow: hidden;
}

.chapter-tabs-inner {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  flex: 1;
  scrollbar-width: thin;
  scrollbar-color: #ddd transparent;
}
.chapter-tabs-inner::-webkit-scrollbar { height: 4px; }
.chapter-tabs-inner::-webkit-scrollbar-thumb { background: #ddd; border-radius: 2px; }

.chapter-tab {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 8px 14px;
  border: 1px solid #ddd;
  border-radius: 8px;
  background: #fff;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  transition: border-color 0.2s, background 0.2s, color 0.2s;
  min-width: 120px;
}

.chapter-tab:hover { border-color: #3498db; background: #f0f7ff; }

.chapter-tab.active {
  border-color: #3498db;
  background: #3498db;
  color: #fff;
}

.tab-title {
  font-size: 13px;
  font-weight: 500;
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tab-count {
  font-size: 11px;
  opacity: 0.7;
}

.chapter-tab.active .tab-count { opacity: 0.85; }

.chapter-tab {
  position: relative;
}

/* 无章节/无选中提示 */
.no-chapter-hint {
  text-align: center;
  color: #999;
  padding: 48px;
  font-size: 15px;
  background: #fafafa;
  border-radius: 8px;
  border: 1px dashed #ddd;
}

/* ---------- 图片区 ---------- */
.viewer-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* 解密工具栏 */
.decrypt-toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  padding: 10px 16px;
  background: #f5f7fa;
  border: 1px solid #e0e6f0;
  border-radius: 8px;
  font-size: 14px;
  color: #555;
}

.decrypt-toolbar.floating {
  position: fixed;
  right: 16px;
  top: 50%;
  transform: translateY(-50%);
  z-index: 1000;
  flex-direction: column;
  align-items: stretch;
  flex-wrap: nowrap;
  gap: 8px;
  padding: 12px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.15);
  background: #fff;
  width: 180px;
}

.decrypt-toolbar.floating .decrypt-group {
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
}

.decrypt-toolbar.floating .decrypt-input {
  width: 100%;
}

.decrypt-toolbar.floating .overwrite-check {
  flex-direction: row;
  align-items: center;
}

.decrypt-toolbar.floating .btn {
  width: 100%;
}

.float-toggle {
  padding: 4px 8px !important;
  font-size: 16px;
  line-height: 1;
}

.decrypt-group {
  display: flex;
  align-items: center;
  gap: 6px;
}

.group-label {
  font-size: 13px;
  color: #666;
  white-space: nowrap;
}

.group-hint {
  font-size: 12px;
  color: #999;
  white-space: nowrap;
}

.decrypt-input {
  width: 50px;
  padding: 4px 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 13px;
}

.order-text {
  width: 220px;
  text-align: left;
  font-family: monospace;
}

.overwrite-check {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  font-size: 13px;
  white-space: nowrap;
}

.overwrite-check input { cursor: pointer; }

/* 图片工具栏 */
.image-toolbar,
.image-toolbar-filter {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.chapter-badge {
  display: flex;
  align-items: center;
  gap: 8px;
}

.chapter-name {
  font-size: 14px;
  font-weight: 500;
  color: #333;
}

.chapter-img-count {
  font-size: 12px;
  color: #888;
  background: #f5f5f5;
  border-radius: 10px;
  padding: 2px 8px;
}

.show-decrypted-check {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #555;
  cursor: pointer;
  white-space: nowrap;
}

/* ---------- 图片网格 ---------- */
.image-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 12px;
}

.image-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.cover-wrapper {
  position: relative;
  aspect-ratio: 3/4;
  background: #f0f0f0;
  border-radius: 6px;
  overflow: hidden;
  cursor: pointer;
}

.cover-wrapper img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.2s;
}
.cover-wrapper:hover img { transform: scale(1.03); }
.cover-wrapper img.decrypted { box-shadow: inset 0 0 0 2px #27ae60; }

.img-badge {
  position: absolute;
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 3px;
  color: white;
}
.badge-decrypted { top: 6px; right: 6px; background: #27ae60; }
.badge-index { bottom: 4px; right: 6px; background: rgba(0,0,0,0.55); }

.image-actions { display: flex; justify-content: center; }

.empty-images {
  grid-column: 1 / -1;
  text-align: center;
  color: #999;
  padding: 60px;
  font-size: 15px;
}

/* ---------- 查看器 ---------- */
.viewer-modal {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.92);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.viewer-close {
  position: absolute;
  top: 20px; right: 24px;
  background: none;
  border: none;
  color: white;
  font-size: 36px;
  cursor: pointer;
  width: 50px; height: 50px;
  display: flex; align-items: center; justify-content: center;
}

.viewer-prev, .viewer-next {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  background: rgba(255,255,255,0.15);
  border: none;
  color: white;
  font-size: 24px;
  padding: 16px 20px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;
}
.viewer-prev { left: 24px; }
.viewer-next { right: 24px; }
.viewer-prev:hover:not(:disabled),
.viewer-next:hover:not(:disabled) { background: rgba(255,255,255,0.25); }
.viewer-prev:disabled, .viewer-next:disabled { opacity: 0.3; cursor: not-allowed; }

.viewer-content {
  max-width: 90vw;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.viewer-content img {
  max-width: 100%;
  max-height: calc(90vh - 50px);
  object-fit: contain;
  border-radius: 4px;
}

.viewer-info {
  color: rgba(255,255,255,0.8);
  font-size: 14px;
  margin-top: 6px;
  text-align: center;
}

/* 自动播放控制条（紧凑） */
.viewer-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
  flex-wrap: wrap;
  justify-content: center;
}

.viewer-play-btn {
  min-width: 56px;
  padding: 4px 14px;
  border: none;
  border-radius: 12px;
  background: rgba(255,255,255,0.2);
  color: #fff;
  font-size: 12px;
  cursor: pointer;
  transition: background 0.2s;
}
.viewer-play-btn:hover { background: rgba(255,255,255,0.35); }

.speed-control {
  display: flex;
  align-items: center;
  gap: 5px;
  color: rgba(255,255,255,0.85);
  font-size: 12px;
}

.speed-input {
  width: 60px;
  padding: 3px 6px;
  border: 1px solid rgba(255,255,255,0.3);
  border-radius: 4px;
  background: rgba(0,0,0,0.35);
  color: #fff;
  font-size: 12px;
  text-align: center;
}
.speed-input:focus { outline: none; border-color: #3498db; }

.speed-presets {
  display: flex;
  gap: 3px;
}

.speed-preset {
  padding: 3px 7px;
  border: 1px solid rgba(255,255,255,0.3);
  border-radius: 4px;
  background: transparent;
  color: rgba(255,255,255,0.85);
  font-size: 11px;
  cursor: pointer;
  transition: all 0.15s;
}
.speed-preset:hover { background: rgba(255,255,255,0.15); }
.speed-preset.active { background: #3498db; border-color: #3498db; color: #fff; }


/* 标签操作按钮（显式展示） */
.tab-actions {
  position: absolute;
  top: 2px;
  right: 2px;
  display: flex;
  gap: 2px;
}

.tab-action {
  width: 18px;
  height: 18px;
  border: none;
  border-radius: 4px;
  background: rgba(0,0,0,0.06);
  color: #555;
  font-size: 11px;
  line-height: 1;
  padding: 0;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s, color 0.15s;
}

.tab-action:hover { background: rgba(0,0,0,0.12); color: #222; }
.tab-action-danger:hover { background: #e74c3c; color: #fff; }

.chapter-tab.active .tab-actions .tab-action {
  background: rgba(255,255,255,0.25);
  color: #fff;
}
.chapter-tab.active .tab-actions .tab-action:hover { background: rgba(255,255,255,0.4); }
.chapter-tab.active .tab-actions .tab-action-danger:hover { background: #fff; color: #e74c3c; }

/* ---------- 通用按钮 ---------- */
.btn {
  padding: 6px 14px;
  border: 1px solid #ddd;
  background: #fff;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  color: #333;
  transition: background 0.2s, border-color 0.2s;
}
.btn:hover { background: #f5f5f5; }
.btn-sm { padding: 4px 12px; font-size: 13px; }
.btn-xs { padding: 2px 8px; font-size: 12px; }

.btn-primary { background: #3498db; color: #fff; border-color: #3498db; }
.btn-primary:hover { background: #2980b9; border-color: #2980b9; }

.btn-danger { background: #e74c3c; color: #fff; border-color: #e74c3c; }
.btn-danger:hover { background: #c0392b; border-color: #c0392b; }

.btn-warning { background: #f39c12; color: #fff; border-color: #f39c12; }
.btn-warning:hover { background: #e67e22; border-color: #e67e22; }

/* ---------- Dialog 表单 ---------- */
.form-group {
  margin-bottom: 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.form-group:last-child { margin-bottom: 0; }

.form-group label {
  font-size: 13px;
  font-weight: 500;
  color: #555;
}

.form-group input,
.form-group textarea {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  box-sizing: border-box;
}
.form-group input:focus,
.form-group textarea:focus { outline: none; border-color: #3498db; }

.form-group small {
  font-size: 12px;
  color: #999;
}

.required { color: #e74c3c; }

/* ---------- 响应式 ---------- */
@media (max-width: 1024px) {
  .image-grid { grid-template-columns: repeat(4, 1fr); }
}
@media (max-width: 768px) {
  .image-grid { grid-template-columns: repeat(3, 1fr); }
  .comic-detail { padding: 12px; gap: 16px; }
  .detail-header { gap: 10px; }
  .comic-title h1 { font-size: 18px; }
  .decrypt-toolbar { gap: 8px; }
}
</style>
