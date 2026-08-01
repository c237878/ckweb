<template>
  <Dialog :visible="visible" :title="editingVideo ? '编辑影片' : '添加影片'" @confirm="handleSave" @cancel="handleCancel">
    <template #content>
      <div class="form-item">
        <label>番号</label>
        <div class="code-row">
          <input v-model="form.code" type="text" placeholder="如: ABC-123" />
          <button type="button" class="autocode-btn" @click="generateCode" :disabled="codeLoading">{{ codeLoading ? '生成中...' : '自动编号' }}</button>
        </div>
      </div>
      <div class="form-item">
        <label>名称 *</label>
        <input v-model="form.name" type="text" placeholder="影片名称（必填）" />
      </div>
      <div class="form-item">
        <label>地区</label>
        <div class="combobox-wrap">
          <input
            v-model="form.country"
            type="text"
            placeholder="选择或输入地区"
            @focus="showCountryDropdown = true"
            @blur="hideDropdown('country')"
          />
          <div v-if="showCountryDropdown" class="combobox-dropdown">
            <div
              v-for="c in filteredCountries"
              :key="c"
              class="combobox-option"
              @mousedown.prevent="selectCountry(c)"
            >
              {{ c }}
            </div>
            <div v-if="filteredCountries.length === 0" class="combobox-empty">暂无已有地区</div>
          </div>
        </div>
      </div>
      <div class="form-item">
        <label>分类</label>
        <div class="combobox-wrap">
          <input
            v-model="form.category"
            type="text"
            placeholder="选择或输入分类"
            @focus="showCatDropdown = true"
            @blur="hideDropdown('cat')"
          />
          <div v-if="showCatDropdown" class="combobox-dropdown">
            <div
              v-for="c in filteredCategories"
              :key="c"
              class="combobox-option"
              @mousedown.prevent="selectCategory(c)"
            >
              {{ c }}
            </div>
            <div v-if="filteredCategories.length === 0" class="combobox-empty">暂无已有分类</div>
          </div>
        </div>
      </div>
      <div class="form-item">
        <label>所属系列</label>
        <div class="combobox-wrap">
          <input
            v-model="seriesInput"
            type="text"
            placeholder="选择或输入系列名称"
            @focus="showSeriesDropdown = true"
            @blur="hideDropdown('series')"
          />
          <div v-if="showSeriesDropdown" class="combobox-dropdown">
            <div
              v-for="s in filteredSeries"
              :key="s.id"
              class="combobox-option"
              @mousedown.prevent="selectSeries(s)"
            >
              {{ s.name }}
            </div>
            <div v-if="filteredSeries.length === 0" class="combobox-empty">暂无已有系列</div>
          </div>
        </div>
      </div>

      <!-- 视频路径：手动输入 + 上传按钮 -->
      <div class="form-item">
        <label>视频路径</label>
        <div class="path-row">
          <input v-model="form.filePath" type="text" placeholder="视频文件完整路径（如 /Volumes/disk1/movies/...）" />
          <button class="upload-btn" @click="showVideoUploadDir" :disabled="uploading">
            <span v-if="uploading && uploadTarget === 'video'">上传中 {{ uploadProgress }}%</span>
            <span v-else>上传视频</span>
          </button>
        </div>
        <!-- 上传进度条 -->
        <div v-if="uploading && uploadTarget === 'video'" class="upload-progress">
          <div class="upload-progress-bar">
            <div class="upload-progress-fill" :style="{ width: uploadProgress + '%' }"></div>
          </div>
          <div class="upload-progress-text">{{ uploadingFileName }}{{ uploadProgress === 100 ? '（处理中...' : '' }}</div>
        </div>
        <div v-if="!uploading && form.fileSize" class="upload-size-hint">文件大小：{{ formatSize(form.fileSize) }}</div>
        <!-- 视频上传目录选择器（显示在按钮下方） -->
        <div v-if="showVideoDirDropdown" class="upload-dir-panel">
          <div class="upload-dir-header">选择保存目录</div>
          <div class="upload-dir-list">
            <div
              v-for="dir in scanDirectories"
              :key="dir.id"
              class="upload-dir-item"
              @click="pickVideoFile(dir.path)"
            >
              {{ dir.path }}
            </div>
          </div>
          <div class="upload-dir-custom">
            <input
              v-model="customVideoDir"
              type="text"
              placeholder="或输入自定义目录路径"
              @keyup.enter="pickVideoFile(customVideoDir)"
            />
            <button @click="pickVideoFile(customVideoDir)" :disabled="!customVideoDir.trim()">使用此目录</button>
          </div>
        </div>
      </div>

      <!-- 封面路径：手动输入 + 上传按钮 -->
      <div class="form-item">
        <label>封面路径</label>
        <div class="path-row">
          <input v-model="form.coverPath" type="text" placeholder="封面图片路径（选填，如 /Volumes/disk1/cover.jpg）" />
          <button class="upload-btn" @click="showCoverUploadDir" :disabled="uploading">
            <span v-if="uploading && uploadTarget === 'cover'">上传中 {{ uploadProgress }}%</span>
            <span v-else>上传封面</span>
          </button>
        </div>
        <!-- 上传进度条 -->
        <div v-if="uploading && uploadTarget === 'cover'" class="upload-progress">
          <div class="upload-progress-bar">
            <div class="upload-progress-fill" :style="{ width: uploadProgress + '%' }"></div>
          </div>
          <div class="upload-progress-text">{{ uploadingFileName }}</div>
        </div>
        <!-- 封面上传目录选择器 -->
        <div v-if="showCoverDirDropdown" class="upload-dir-panel">
          <div class="upload-dir-header">选择保存目录</div>
          <div class="upload-dir-list">
            <div
              v-for="dir in scanDirectories"
              :key="dir.id"
              class="upload-dir-item"
              @click="pickCoverFile(dir.path)"
            >
              {{ dir.path.replace(/[\\/]video$/i, '/cover').replace(/[\\/]video[\\/]/i, '/cover/') }}
            </div>
          </div>
          <div class="upload-dir-custom">
            <input
              v-model="customCoverDir"
              type="text"
              placeholder="或输入自定义目录路径"
              @keyup.enter="pickCoverFile(customCoverDir)"
            />
            <button @click="pickCoverFile(customCoverDir)" :disabled="!customCoverDir.trim()">使用此目录</button>
          </div>
        </div>
      </div>

      <!-- 演员 -->
      <div class="form-item">
        <label>演员</label>
        <div class="actor-selector">
          <div class="selected-actors">
            <span v-for="actor in selectedActors" :key="actor.id" class="actor-tag">
              {{ actor.name }}
              <button class="remove-btn" @click="removeActor(actor.id)">×</button>
            </span>
          </div>
          <div class="input-with-suggestions">
            <input
              v-model="actorSearch"
              type="text"
              placeholder="搜索演员并添加"
              @input="searchActors"
            />
            <div v-if="matchedActors.length > 0" class="suggestions">
              <div
                v-for="actor in matchedActors"
                :key="actor.id"
                class="suggestion-item"
                @mousedown="addActor(actor)"
              >
                {{ actor.name }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 隐藏的文件选择器 -->
      <input
        ref="videoFileInputRef"
        type="file"
        accept="video/*"
        style="display:none"
        @change="onVideoFileSelected"
      />
      <input
        ref="coverFileInputRef"
        type="file"
        accept="image/*"
        style="display:none"
        @change="onCoverFileSelected"
      />
    </template>
    <template #actions>
      <button v-if="editingVideo" class="delete-btn" @click="handleDelete">删除</button>
    </template>
    <template #extra-actions>
      <button v-if="!editingVideo" class="continue-btn" @click="handleSaveContinue">连续添加</button>
    </template>
  </Dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { videoApi, actorApi, scanDirectoryApi, uploadApi } from '@/scripts/api'
import { formatSize } from '@/scripts/utils/format'
import Dialog from './Dialog.vue'

const props = defineProps({
  visible: Boolean,
  editingVideo: Object
})

const emit = defineEmits(['save', 'save-continue', 'cancel', 'delete'])

const actorList = ref([])
const selectedActors = ref([])
const actorSearch = ref('')
const matchedActors = ref([])
const codeLoading = ref(false)
const meta = ref({ categories: [], countries: [], series: [] })
const scanDirectories = ref([])

const showCatDropdown = ref(false)
const showCountryDropdown = ref(false)
const showSeriesDropdown = ref(false)
const showVideoDirDropdown = ref(false)
const showCoverDirDropdown = ref(false)
const customVideoDir = ref('')
const customCoverDir = ref('')
const uploading = ref(false)
const uploadTarget = ref('')
const uploadProgress = ref(0)
const uploadingFileName = ref('')
const videoFileInputRef = ref(null)
const coverFileInputRef = ref(null)
const pendingUploadDir = ref('')

const seriesInput = ref('')

const seriesList = computed(() => meta.value.series || [])

const filteredCategories = computed(() => {
  const list = meta.value.categories || []
  if (!form.value.category) return list
  return list.filter(c => c.toLowerCase().includes(form.value.category.toLowerCase()))
})

const filteredCountries = computed(() => {
  const list = meta.value.countries || []
  if (!form.value.country) return list
  return list.filter(c => c.toLowerCase().includes(form.value.country.toLowerCase()))
})

const filteredSeries = computed(() => {
  const list = seriesList.value || []
  if (!seriesInput.value) return list.slice(0, 50)
  return list.filter(s => s.name.toLowerCase().includes(seriesInput.value.toLowerCase())).slice(0, 50)
})

const form = ref({
  name: '',
  code: '',
  category: '',
  country: '',
  seriesId: '',
  filePath: '',
  coverPath: '',
  fileSize: null
})

// ===== 上传相关 =====
const loadScanDirectories = async () => {
  try {
    const res = await scanDirectoryApi.getList()
    if (res.success) {
      scanDirectories.value = res.data || []
    }
  } catch (e) {
    console.error('加载扫描目录失败:', e)
  }
}

// 显示视频上传目录选择器
const showVideoUploadDir = () => {
  showVideoDirDropdown.value = !showVideoDirDropdown.value
  showCoverDirDropdown.value = false
  customVideoDir.value = ''
}

// 显示封面上传目录选择器
const showCoverUploadDir = () => {
  showCoverDirDropdown.value = !showCoverDirDropdown.value
  showVideoDirDropdown.value = false
  customCoverDir.value = ''
}

// 选择视频目录后触发文件选择器
const pickVideoFile = (dir) => {
  if (!dir) return
  pendingUploadDir.value = dir
  showVideoDirDropdown.value = false
  videoFileInputRef.value?.click()
}

// 选择封面目录后触发文件选择器
const pickCoverFile = (dir) => {
  if (!dir) return
  // 把路径中的 video 替换为 cover
  const coverDir = dir.replace(/[\\/]video$/i, '/cover').replace(/[\\/]video[\\/]/i, '/cover/')
  pendingUploadDir.value = coverDir
  showCoverDirDropdown.value = false
  coverFileInputRef.value?.click()
}

// 视频文件选择后上传
const onVideoFileSelected = async (e) => {
  const file = e.target.files?.[0]
  if (!file) return
  await doUpload('video', pendingUploadDir.value, file)
  e.target.value = '' // 清空，支持重复选择同一文件
}

// 封面文件选择后上传
const onCoverFileSelected = async (e) => {
  const file = e.target.files?.[0]
  if (!file) return
  await doUpload('cover', pendingUploadDir.value, file)
  e.target.value = ''
}

// 执行上传
const doUpload = async (type, directory, file) => {
  uploading.value = true
  uploadTarget.value = type
  uploadProgress.value = 0
  uploadingFileName.value = file.name
  try {
    const onProgress = (progressEvent) => {
      if (progressEvent.total) {
        uploadProgress.value = Math.round((progressEvent.loaded / progressEvent.total) * 100)
      }
    }
    const res = type === 'video'
      ? await uploadApi.uploadVideo(directory, file, onProgress)
      : await uploadApi.uploadCover(directory, file, onProgress)
    if (res.success) {
      if (type === 'video') {
        form.value.filePath = res.filePath
        form.value.fileSize = res.fileSize
        // 编辑模式：立即更新数据库 file_size
        if (props.editingVideo?.id) {
          await videoApi.updateFileInfo(props.editingVideo.id, {
            filePath: res.filePath,
            fileSize: res.fileSize
          })
        }
      } else {
        form.value.coverPath = res.filePath
        if (props.editingVideo?.id) {
          await videoApi.updateFileInfo(props.editingVideo.id, {
            coverPath: res.filePath
          })
        }
      }
    } else {
      alert('上传失败: ' + (res.message || '未知错误'))
    }
  } catch (err) {
    console.error('上传失败:', err)
    alert('上传失败: ' + (err.response?.status || '') + ' ' + (err.message || err))
  } finally {
    uploading.value = false
    uploadTarget.value = ''
    uploadProgress.value = 0
    uploadingFileName.value = ''
    pendingUploadDir.value = ''
  }
}

// ===== 其他方法 =====

const selectCategory = (val) => {
  form.value.category = val
  showCatDropdown.value = false
}

const selectCountry = (val) => {
  form.value.country = val
  showCountryDropdown.value = false
}

const selectSeries = (s) => {
  form.value.seriesId = s.id
  seriesInput.value = s.name
  showSeriesDropdown.value = false
}

const hideDropdown = (type) => {
  setTimeout(() => {
    if (type === 'cat') showCatDropdown.value = false
    if (type === 'country') showCountryDropdown.value = false
    if (type === 'series') {
      showSeriesDropdown.value = false
      const matched = seriesList.value.find(s => s.name === seriesInput.value)
      if (matched) {
        form.value.seriesId = matched.id
      } else {
        form.value.seriesId = ''
      }
    }
  }, 200)
}

const searchActors = async () => {
  if (!actorSearch.value.trim()) {
    matchedActors.value = []
    return
  }
  try {
    const res = await actorApi.getList({ keyword: actorSearch.value.trim(), pageSize: 50 })
    if (res.success) {
      matchedActors.value = (res.data?.items || res.data || []).filter(a => !selectedActors.value.some(s => s.id === a.id))
    }
  } catch (error) {
    console.error('搜索演员失败:', error)
  }
}

const addActor = (actor) => {
  if (!selectedActors.value.some(a => a.id === actor.id)) {
    selectedActors.value.push(actor)
  }
  actorSearch.value = ''
  matchedActors.value = []
}

const removeActor = (actorId) => {
  selectedActors.value = selectedActors.value.filter(a => a.id !== actorId)
}

const generateCode = async () => {
  codeLoading.value = true
  try {
    const res = await videoApi.getAutoCode()
    if (res.success) {
      form.value.code = res.code
    }
  } catch (e) {
    console.error('生成自动编号失败:', e)
  }
  codeLoading.value = false
}

const loadMeta = async () => {
  try {
    const res = await videoApi.getMeta()
    if (res.success) {
      meta.value = {
        categories: res.categories || [],
        countries: res.countries || [],
        series: res.series || []
      }
    }
  } catch (error) {
    console.error('加载元数据失败:', error)
  }
}

const loadActorList = async () => {
  try {
    const res = await actorApi.getList()
    if (res.success) {
      actorList.value = res.data || []
    }
  } catch (error) {
    console.error('加载演员列表失败:', error)
  }
}

watch(() => props.visible, async (val) => {
  if (val) {
    await Promise.all([loadMeta(), loadActorList(), loadScanDirectories()])
    // 关闭所有目录选择器
    showVideoDirDropdown.value = false
    showCoverDirDropdown.value = false
    if (props.editingVideo) {
      try {
        const detail = await videoApi.getDetail(props.editingVideo.id)
        if (detail.success && detail.data) {
          form.value = {
            name: detail.data.video.name || '',
            code: detail.data.video.code || '',
            category: detail.data.video.category || '',
            country: detail.data.video.country || '',
            seriesId: detail.data.video.seriesId || '',
            filePath: detail.data.video.filePath || '',
            coverPath: detail.data.video.coverPath || ''
          }
          if (detail.data.video.seriesId && detail.data.video.seriesName) {
            seriesInput.value = detail.data.video.seriesName
          } else {
            seriesInput.value = ''
          }
          selectedActors.value = detail.data.actors || []
        }
      } catch (e) {
        console.error('加载影片详情失败', e)
      }
    } else {
      resetForm()
    }
  }
})

const resetForm = () => {
  form.value = { name: '', code: '', category: '', country: '', seriesId: '', filePath: '', coverPath: '', fileSize: null }
  seriesInput.value = ''
  selectedActors.value = []
  actorSearch.value = ''
  matchedActors.value = []
}

const handleSave = () => {
  if (!form.value.name.trim()) {
    alert('请输入影片名称')
    return
  }
  emit('save', {
    id: props.editingVideo?.id,
    name: form.value.name,
    code: form.value.code,
    category: form.value.category,
    country: form.value.country,
    seriesId: form.value.seriesId,
    filePath: form.value.filePath,
    coverPath: form.value.coverPath,
    fileSize: form.value.fileSize,
    actorIds: selectedActors.value.map(a => a.id)
  })
}

const handleSaveContinue = () => {
  if (!form.value.name.trim()) {
    alert('请输入影片名称')
    return
  }
  emit('save-continue', {
    name: form.value.name,
    code: form.value.code,
    category: form.value.category,
    country: form.value.country,
    seriesId: form.value.seriesId,
    filePath: form.value.filePath,
    coverPath: form.value.coverPath,
    fileSize: form.value.fileSize,
    actorIds: selectedActors.value.map(a => a.id)
  })
  // 清空番号、视频路径、封面路径、演员
  form.value.code = ''
  form.value.filePath = ''
  form.value.coverPath = ''
  form.value.fileSize = null
  selectedActors.value = []
  actorSearch.value = ''
  matchedActors.value = []
}

const handleCancel = () => {
  emit('cancel')
}

const handleDelete = () => {
  emit('delete', props.editingVideo?.id)
}
</script>

<style scoped>
.form-item { margin-bottom: 16px; }
.form-item label { display: block; margin-bottom: 6px; font-size: 14px; color: #666; }
.form-item input, .form-item select { width: 100%; padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; box-sizing: border-box; }
.code-row { display: flex; gap: 8px; }
.code-row input { flex: 1; }
.autocode-btn { white-space: nowrap; padding: 8px 14px; border: 1px solid #4a9eff; background: #4a9eff; color: #fff; border-radius: 4px; cursor: pointer; font-size: 13px; }
.autocode-btn:hover { background: #3a8eef; }
.autocode-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.combobox-wrap { position: relative; }
.combobox-dropdown { position: absolute; top: 100%; left: 0; right: 0; background: #fff; border: 1px solid #ddd; border-radius: 4px; margin-top: 4px; max-height: 200px; overflow-y: auto; z-index: 10; }
.combobox-option { padding: 8px 12px; cursor: pointer; }
.combobox-option:hover { background: #f5f5f5; }
.combobox-empty { padding: 8px 12px; color: #999; font-size: 13px; }
.actor-selector { border: 1px solid #ddd; border-radius: 4px; padding: 8px; }
.selected-actors { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
.actor-tag { background: #e3f2fd; color: #1976d2; padding: 4px 8px; border-radius: 4px; font-size: 13px; display: flex; align-items: center; gap: 4px; }
.remove-btn { background: none; border: none; color: #1976d2; cursor: pointer; font-size: 16px; line-height: 1; }
.input-with-suggestions { position: relative; }
.input-with-suggestions input { width: 100%; padding: 6px 10px; border: 1px solid #eee; border-radius: 3px; }
.suggestions { position: absolute; top: 100%; left: 0; right: 0; background: #fff; border: 1px solid #ddd; border-radius: 4px; margin-top: 2px; max-height: 150px; overflow-y: auto; z-index: 10; }
.suggestion-item { padding: 6px 10px; cursor: pointer; font-size: 13px; }
.suggestion-item:hover { background: #f5f5f5; }
.delete-btn { padding: 8px 16px; background: #e74c3c; color: white; border: none; border-radius: 4px; cursor: pointer; }
.delete-btn:hover { background: #c0392b; }
.continue-btn { padding: 8px 16px; background: #27ae60; color: white; border: none; border-radius: 4px; cursor: pointer; }
.continue-btn:hover { background: #229954; }

/* 路径行 + 上传按钮 */
.path-row { display: flex; gap: 8px; align-items: center; }
.path-row input { flex: 1; }
.upload-btn {
  padding: 8px 14px;
  background: #3498db;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  white-space: nowrap;
  flex-shrink: 0;
}
.upload-btn:hover { background: #2980b9; }
.upload-btn:disabled { background: #b0bec5; cursor: not-allowed; }

/* 上传目录选择面板 */
.upload-dir-panel {
  margin-top: 8px;
  border: 1px solid #ddd;
  border-radius: 6px;
  background: #fafafa;
  overflow: hidden;
}
.upload-dir-header {
  padding: 8px 12px;
  font-size: 13px;
  color: #666;
  background: #f0f0f0;
  border-bottom: 1px solid #ddd;
  font-weight: 500;
}
.upload-dir-list {
  max-height: 160px;
  overflow-y: auto;
}
.upload-dir-item {
  padding: 8px 12px;
  font-size: 13px;
  cursor: pointer;
  color: #333;
  word-break: break-all;
}
.upload-dir-item:hover { background: #e3f2fd; color: #1976d2; }
.upload-dir-custom {
  display: flex;
  gap: 6px;
  padding: 8px 12px;
  border-top: 1px solid #ddd;
}
.upload-dir-custom input {
  flex: 1;
  padding: 6px 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 13px;
  box-sizing: border-box;
}
.upload-dir-custom button {
  padding: 6px 12px;
  background: #27ae60;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  white-space: nowrap;
}
.upload-dir-custom button:hover { background: #219653; }
.upload-dir-custom button:disabled { background: #b0bec5; cursor: not-allowed; }

/* 上传进度条 */
.upload-progress {
  margin-top: 8px;
}
.upload-progress-bar {
  height: 6px;
  background: #e0e0e0;
  border-radius: 3px;
  overflow: hidden;
}
.upload-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #3498db, #2ecc71);
  border-radius: 3px;
  transition: width 0.2s ease;
}
.upload-progress-text {
  font-size: 12px;
  color: #888;
  margin-top: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.upload-size-hint {
  font-size: 12px;
  color: #52c41a;
  margin-top: 2px;
}
</style>
