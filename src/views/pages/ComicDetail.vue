<template>
  <div class="comic-detail" v-if="comic">
    <div class="detail-header">
      <button class="back-btn" @click="$router.back()">← 返回</button>
      <div class="comic-title">
        <h1>{{ comic.name }}</h1>
        <span class="author" v-if="comic.author">作者：{{ comic.author }}</span>
      </div>
      <div class="header-actions">
        <button class="btn btn-primary" @click="showEdit = true">编辑</button>
        <button class="btn btn-danger" @click="handleDelete">删除</button>
      </div>
    </div>

    <div class="comic-info" v-if="comic.description || comic.url || comic.directory">
      <div class="info-row" v-if="comic.description">
        <span class="label">简介：</span>
        <span class="value">{{ comic.description }}</span>
      </div>
      <div class="info-row" v-if="comic.url">
        <span class="label">链接：</span>
        <a :href="comic.url" target="_blank" class="value link">{{ comic.url }}</a>
      </div>
      <div class="info-row" v-if="comic.directory">
        <span class="label">目录：</span>
        <span class="value">{{ comic.directory }}</span>
      </div>
    </div>

    <!-- 章节管理 -->
    <div class="chapter-section">
      <div class="chapter-header">
        <h3>章节列表</h3>
        <button class="btn btn-primary btn-sm" @click="showAddChapter = true">+ 添加章节</button>
      </div>
      <div class="chapter-list" v-if="chapters.length > 0">
        <div
          v-for="ch in chapters"
          :key="ch.id"
          class="chapter-item"
          :class="{ active: currentChapter?.id === ch.id }"
          @click="selectChapter(ch)"
        >
          <div class="chapter-info">
            <span class="chapter-title">{{ ch.title }}</span>
            <span class="chapter-count">{{ ch.imageCount }} 图</span>
          </div>
          <div class="chapter-actions" @click.stop>
            <button class="btn btn-xs" @click="openEditChapter(ch)">编</button>
            <button class="btn btn-xs btn-danger" @click="deleteChapter(ch)">删</button>
          </div>
        </div>
      </div>
      <div class="empty-chapters" v-else>暂无章节</div>
    </div>

    <!-- 图片浏览区 -->
    <div class="viewer-section" v-if="currentChapter">
      <div class="viewer-header">
        <div class="decrypt-config">
          <span>切割行数：</span>
          <input v-model.number="decryptConfig.rows" type="number" min="2" max="10" class="config-input" @change="syncOrderLength" />
          <span class="order-label">排列顺序：</span>
          <span v-for="(_, i) in decryptConfig.rows" :key="i" class="order-item">
            <input
              v-model.number="decryptConfig.order[i]"
              type="number"
              :max="decryptConfig.rows - 1"
              min="0"
              class="config-input order-input"
            />
          </span>
          <small class="hint">输入 0~{{ decryptConfig.rows - 1 }} 的排列，如 [2,0,1]</small>
          <button class="btn btn-warning" @click="decryptAllImages" :disabled="decrypting">
            {{ decrypting ? '解密中...' : '批量解密本章' }}
          </button>
          <label class="overwrite-label">
            <input type="checkbox" v-model="decryptConfig.overwrite" />
            覆盖已解密
          </label>
        </div>
      </div>

      <div class="image-toolbar">
        <span class="chapter-name">{{ currentChapter.title }}</span>
        <label class="show-decrypted">
          <input type="checkbox" v-model="showDecryptedOnly" />
          仅显示已解密
        </label>
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
            <div class="image-label" v-if="img.isDecrypted">✓</div>
            <div class="image-index">{{ idx + 1 }}</div>
          </div>
          <div class="image-actions" @click.stop>
            <button class="btn btn-xs" @click.stop="decryptSingle(img)" :disabled="false">
              {{ img.isDecrypted ? '重解密' : '解密' }}
            </button>
          </div>
        </div>
        <div v-if="filteredImages.length === 0" class="empty-images">
          <span v-if="showDecryptedOnly">当前目录下没有已解密图片</span>
          <span v-else>该章节暂无图片</span>
        </div>
      </div>
    </div>

    <div class="no-chapter-hint" v-if="!currentChapter && chapters.length > 0">
      请从上方选择一个章节开始阅读
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
      </div>
      <button class="viewer-next" @click="nextImage" :disabled="viewer.index >= filteredImages.length - 1">▶</button>
    </div>

    <!-- 添加章节对话框 -->
    <Dialog :visible="showAddChapter" title="添加章节" @cancel="showAddChapter = false" @confirm="handleAddChapter">
      <template #content>
        <div class="form-group">
          <label>章节标题</label>
          <input v-model="chapterForm.title" type="text" placeholder="章节标题（默认为目录名）" />
        </div>
        <div class="form-group">
          <label>章节目录 *</label>
          <input v-model="chapterForm.directory" type="text" placeholder="章节图片所在目录路径" />
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
          <input v-model="editChapterForm.directory" type="text" placeholder="章节图片所在目录路径" />
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
          <label>名称 *</label>
          <input v-model="editForm.name" type="text" />
        </div>
        <div class="form-group">
          <label>作者</label>
          <input v-model="editForm.author" type="text" />
        </div>
        <div class="form-group">
          <label>简介</label>
          <textarea v-model="editForm.description" rows="3"></textarea>
        </div>
        <div class="form-group">
          <label>链接</label>
          <input v-model="editForm.url" type="text" />
        </div>
        <div class="form-group">
          <label>目录</label>
          <input v-model="editForm.directory" type="text" />
        </div>
      </template>
      <template #actions>
        <button class="btn" @click="showEdit = false">取消</button>
        <button class="btn btn-primary" @click="handleUpdate">保存</button>
      </template>
    </Dialog>
  </div>

  <div class="loading" v-else-if="loading">加载中...</div>
</template>

<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue'
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
const editChapterForm = ref({ title: '', directory: '', sortOrder: 0 })
const showDecryptedOnly = ref(false)

const editForm = ref({ name: '', author: '', description: '', url: '', directory: '' })
const chapterForm = ref({ title: '', directory: '' })
const images = ref([])

const decryptConfig = ref({
  rows: 3,
  order: [2, 0, 1],
  overwrite: true
})
const decrypting = ref(false)

const viewer = ref({
  show: false,
  index: 0,
  currentSrc: '',
  currentDecrypted: false
})

const filteredImages = computed(() => {
  if (!showDecryptedOnly.value) return images.value
  return images.value.filter(img => img.isDecrypted)
})

const loadComic = async () => {
  loading.value = true
  try {
    const res = await comicApi.getDetail(route.params.id)
    if (res.success) {
      comic.value = res.data.comic
      chapters.value = res.data.chapters || []
      if (chapters.value.length > 0 && !currentChapter.value) {
        selectChapter(chapters.value[0])
      }
    }
  } catch (error) {
    console.error('加载漫画失败:', error)
    alert('加载失败：' + error.message)
  } finally {
    loading.value = false
  }
}

const selectChapter = async (ch) => {
  currentChapter.value = ch
  showDecryptedOnly.value = false
  viewer.value.show = false
  try {
    const res = await comicApi.getChapterImages(ch.id)
    if (res.success) {
      images.value = res.data.images || []
    }
  } catch (error) {
    console.error('加载图片失败:', error)
    images.value = []
  }
}

const openEditChapter = (ch) => {
  editingChapter.value = ch
  editChapterForm.value = {
    title: ch.title || '',
    directory: ch.directory || '',
    sortOrder: ch.sortOrder || 0
  }
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

const getImageUrl = (img) => {
  if (img.isDecrypted) {
    return comicApi.getImageUrl(currentChapter.value.id, img.fileName) + '?decrypted=1&t=' + Date.now()
  }
  return comicApi.getImageUrl(currentChapter.value.id, img.fileName)
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

const syncOrderLength = () => {
  const len = decryptConfig.value.rows
  while (decryptConfig.value.order.length < len) {
    const next = decryptConfig.value.order.length
    decryptConfig.value.order.push(next)
  }
  decryptConfig.value.order = decryptConfig.value.order.slice(0, len)
}

const decryptAllImages = async () => {
  if (decrypting.value) return
  if (!currentChapter.value) return
  try {
    decrypting.value = true
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

const refreshImage = (img) => {
  img.isDecrypted = true
  nextTick(() => {
    const el = document.querySelector(`.image-item[data-filename="${img.fileName}"] img`)
    if (el) el.src = getImageUrl(img) + '&_=' + Date.now()
  })
}

const openViewer = (idx) => {
  viewer.value.index = idx
  viewer.value.currentSrc = getImageUrl(filteredImages.value[idx])
  viewer.value.currentDecrypted = filteredImages.value[idx].isDecrypted
  viewer.value.show = true
  updateViewerImage()
}

const updateViewerImage = () => {
  const img = filteredImages.value[viewer.value.index]
  if (!img) return
  viewer.value.currentSrc = getImageUrl(img) + '&_=' + Date.now()
  viewer.value.currentDecrypted = img.isDecrypted
}

const prevImage = () => {
  if (viewer.value.index > 0) {
    viewer.value.index--
    updateViewerImage()
  }
}

const nextImage = () => {
  if (viewer.value.index < filteredImages.value.length - 1) {
    viewer.value.index++
    updateViewerImage()
  }
}

const closeViewer = () => {
  viewer.value.show = false
}

const handleViewerImgError = (e) => {
  e.target.style.display = 'none'
}

const handleDelete = async () => {
  if (!confirm('确定要删除这本漫画吗？')) return
  try {
    const res = await comicApi.delete(route.params.id)
    if (res.success) {
      router.push('/comics')
    } else {
      alert(res.message || '删除失败')
    }
  } catch (error) {
    alert('删除失败：' + (error.message || error))
  }
}

const handleUpdate = async () => {
  try {
    const res = await comicApi.update(route.params.id, {
      name: editForm.value.name,
      author: editForm.value.author || undefined,
      description: editForm.value.description || undefined,
      url: editForm.value.url || undefined,
      directory: editForm.value.directory || undefined
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

// 键盘快捷键
const handleKeydown = (e) => {
  if (!viewer.value.show) return
  if (e.key === 'ArrowLeft') prevImage()
  else if (e.key === 'ArrowRight') nextImage()
  else if (e.key === 'Escape') closeViewer()
}

// ESC 关闭编辑对话框
watch(showEdit, (val) => {
  if (val) {
    editForm.value = {
      name: comic.value?.name || '',
      author: comic.value?.author || '',
      description: comic.value?.description || '',
      url: comic.value?.url || '',
      directory: comic.value?.directory || ''
    }
  }
})

onMounted(() => {
  loadComic()
  window.addEventListener('keydown', handleKeydown)
})
</script>

<style scoped>
.comic-detail {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 20px 20px;
}

.detail-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 0;
  border-bottom: 1px solid #eee;
  margin-bottom: 16px;
}

.back-btn {
  padding: 8px 16px;
  background: #f5f5f5;
  border: 1px solid #ddd;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  color: #333;
}

.back-btn:hover { background: #eee; }

.comic-title {
  flex: 1;
  display: flex;
  align-items: baseline;
  gap: 12px;
}

.comic-title h1 { margin: 0; font-size: 24px; color: #333; }
.author { font-size: 14px; color: #888; }

.header-actions {
  display: flex;
  gap: 8px;
}

.comic-info {
  background: #f9f9f9;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.info-row {
  display: flex;
  gap: 8px;
  font-size: 14px;
}

.label { color: #888; font-weight: 500; white-space: nowrap; }
.value { color: #333; }
.link { color: #3498db; text-decoration: none; }
.link:hover { text-decoration: underline; }

/* 章节 */
.chapter-section {
  margin-bottom: 20px;
}

.chapter-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.chapter-header h3 {
  margin: 0;
  font-size: 16px;
  color: #333;
}

.chapter-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.chapter-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: #fff;
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  cursor: pointer;
  transition: box-shadow 0.2s;
}

.chapter-item:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
.chapter-item.active { border-color: #3498db; background: #f0f7ff; }

.chapter-info {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
}

.chapter-title {
  font-size: 14px;
  color: #333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chapter-count {
  font-size: 12px;
  color: #888;
  white-space: nowrap;
}

.chapter-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

.empty-chapters {
  text-align: center;
  color: #999;
  padding: 24px;
  font-size: 14px;
}

/* 图片区 */
.viewer-section { margin-top: 8px; }

.viewer-header { margin-bottom: 12px; }

.decrypt-config {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 14px;
  color: #555;
  background: #f5f7fa;
  border: 1px solid #e0e6f0;
  border-radius: 8px;
  padding: 10px 16px;
}

.config-input {
  width: 60px;
  padding: 4px 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 13px;
  text-align: center;
}

.order-label { margin-left: 8px; }

.order-item { display: inline-flex; }

.order-input {
  width: 44px;
  margin-right: 4px;
}

.hint { color: #888; font-size: 12px; margin-left: 4px; }

.image-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.chapter-name {
  font-size: 14px;
  font-weight: 500;
  color: #333;
}

.show-decrypted {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #555;
  cursor: pointer;
}

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

.cover-wrapper img.decrypted {
  box-shadow: 0 0 0 2px #27ae60;
}

.image-label {
  position: absolute;
  top: 6px;
  right: 6px;
  background: #27ae60;
  color: white;
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 3px;
}

.image-index {
  position: absolute;
  bottom: 4px;
  right: 6px;
  background: rgba(0,0,0,0.55);
  color: white;
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 3px;
}

.image-actions {
  display: flex;
  justify-content: center;
}

.empty-images {
  grid-column: 1 / -1;
  text-align: center;
  color: #999;
  padding: 60px;
  font-size: 16px;
}

.no-chapter-hint {
  text-align: center;
  color: #999;
  padding: 60px;
  font-size: 16px;
}

/* 查看器 */
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
  top: 20px;
  right: 24px;
  background: none;
  border: none;
  color: white;
  font-size: 36px;
  cursor: pointer;
  width: 50px;
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.viewer-prev,
.viewer-next {
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
.viewer-prev:hover:not(:disabled) { background: rgba(255,255,255,0.25); }
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
  max-height: calc(90vh - 40px);
  object-fit: contain;
  border-radius: 4px;
}

.viewer-info {
  color: rgba(255,255,255,0.8);
  font-size: 14px;
  margin-top: 12px;
  text-align: center;
}

/* 通用按钮 */
.btn {
  padding: 6px 14px;
  border: 1px solid #ddd;
  background: #fff;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  color: #333;
  transition: background 0.2s;
}

.btn:hover { background: #f5f5f5; }

.btn-sm { padding: 4px 12px; font-size: 13px; }

.btn-primary { background: #3498db; color: white; border-color: #3498db; }
.btn-primary:hover { background: #2980b9; }

.btn-danger { background: #e74c3c; color: white; border-color: #e74c3c; }
.btn-danger:hover { background: #c0392b; }

.btn-warning { background: #f39c12; color: white; border-color: #f39c12; }
.btn-warning:hover { background: #e67e22; }

.btn-xs { padding: 2px 8px; font-size: 12px; }

.loading {
  text-align: center;
  padding: 60px;
  color: #888;
  font-size: 16px;
}

/* Dialog form */
.form-group { margin-bottom: 14px; }

.form-group label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: #555;
  margin-bottom: 5px;
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

.form-group textarea { resize: vertical; }

.form-group small {
  display: block;
  margin-top: 4px;
  color: #999;
  font-size: 12px;
}

@media (max-width: 768px) {
  .image-grid { grid-template-columns: repeat(3, 1fr); }
  .chapter-item { padding: 10px 12px; }
}
</style>
