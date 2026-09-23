<template>
  <Dialog
    :visible="visible"
    :title="editingVideo ? '编辑影片' : '添加影片'"
    size="wide"
    @confirm="handleSave"
    @cancel="handleCancel"
  >
    <template #content>
      <div class="form">
        <div class="field">
          <label for="av-code">番号</label>
          <div class="row">
            <input
              id="av-code"
              v-model="form.code"
              class="input"
              type="text"
              placeholder="如: ABC-123"
            />
            <button type="button" class="btn btn--sm" :disabled="codeLoading" @click="generateCode">
              {{ codeLoading ? '生成中...' : '自动编号' }}
            </button>
          </div>
        </div>

        <div class="field">
          <label for="av-name">名称 <span class="req">*</span></label>
          <input
            id="av-name"
            v-model="form.name"
            class="input"
            type="text"
            placeholder="影片名称（必填）"
            maxlength="200"
          />
        </div>

        <div class="row row--two">
          <!-- 地区 / 分类的可选值来自系统设置的规范列表，这里只做选择；
               要新增取值去 设置 → 数据源 -->
          <label class="field">
            <span class="field__label">地区</span>
            <SelectList v-model="form.country" :options="countryOptions" label="选择地区" />
          </label>

          <label class="field">
            <span class="field__label">分类</span>
            <SelectList v-model="form.category" :options="categoryOptions" label="选择分类" />
          </label>
        </div>

        <label class="field">
          <span class="field__label">所属系列</span>
          <ComboBox
            v-model="form.seriesId"
            :options="seriesOptions"
            placeholder="选择或输入系列名称"
            all-label="（无系列）"
          />
        </label>

        <!-- 视频路径：手动输入 + 自动填充 + 上传 -->
        <div class="field">
          <label for="av-file-path">视频路径</label>
          <div class="row">
            <input
              id="av-file-path"
              v-model="form.filePath"
              class="input"
              type="text"
              placeholder="视频文件完整路径（如 /Volumes/disk1/movies/...）"
            />
            <button type="button" class="btn btn--sm" title="根据番号自动填充" @click="fillVideoPath">填充</button>
            <button type="button" class="btn btn--sm" :disabled="uploading" @click="showVideoUploadDir">
              <span v-if="uploading && uploadTarget === 'video'">上传中 {{ uploadProgress }}%</span>
              <span v-else>上传视频</span>
            </button>
          </div>

          <div v-if="uploading && uploadTarget === 'video'" class="progress">
            <div class="progress__bar">
              <div class="progress__fill" :style="{ width: uploadProgress + '%' }"></div>
            </div>
            <div class="progress__text">
              {{ uploadingFileName }}{{ uploadProgress === 100 ? '（处理中...' : '' }}
            </div>
          </div>
          <p v-else-if="!uploading && form.fileSize" class="hint">文件大小：{{ formatSize(form.fileSize) }}</p>

          <div v-if="showVideoDirDropdown" class="panel dir-panel">
            <p class="dir-panel__head">选择保存目录</p>
            <div class="dir-panel__list">
              <button
                v-for="dir in videoDirs"
                :key="dir.id"
                type="button"
                class="dir-panel__item"
                @click="pickVideoFile(dir.path)"
              >
                {{ dir.path }}
              </button>
              <p v-if="videoDirs.length === 0" class="hint">没有配置视频保存目录</p>
            </div>
            <div class="row">
              <input
                id="av-custom-video-dir"
                v-model="customVideoDir"
                class="input"
                type="text"
                placeholder="或输入自定义目录路径"
                @keyup.enter="pickVideoFile(customVideoDir)"
              />
              <button type="button" class="btn btn--sm" :disabled="!customVideoDir.trim()" @click="pickVideoFile(customVideoDir)">
                使用此目录
              </button>
            </div>
          </div>
        </div>

        <!-- 封面路径：手动输入 + 自动填充 + 上传 -->
        <div class="field">
          <label for="av-cover-path">封面路径</label>
          <div class="row">
            <input
              id="av-cover-path"
              v-model="form.coverPath"
              class="input"
              type="text"
              placeholder="封面图片路径（选填，如 /Volumes/disk1/cover.jpg）"
            />
            <button type="button" class="btn btn--sm" title="根据番号自动填充" @click="fillCoverPath">填充</button>
            <button type="button" class="btn btn--sm" :disabled="uploading" @click="showCoverUploadDir">
              <span v-if="uploading && uploadTarget === 'cover'">上传中 {{ uploadProgress }}%</span>
              <span v-else>上传封面</span>
            </button>
          </div>

          <div v-if="uploading && uploadTarget === 'cover'" class="progress">
            <div class="progress__bar">
              <div class="progress__fill" :style="{ width: uploadProgress + '%' }"></div>
            </div>
            <div class="progress__text">{{ uploadingFileName }}</div>
          </div>

          <div v-if="showCoverDirDropdown" class="panel dir-panel">
            <p class="dir-panel__head">选择保存目录</p>
            <div class="dir-panel__list">
              <button
                v-for="dir in coverDirs"
                :key="dir.id"
                type="button"
                class="dir-panel__item"
                @click="pickCoverFile(dir.path)"
              >
                {{ toCoverDir(dir.path) }}
              </button>
              <p v-if="coverDirs.length === 0" class="hint">没有配置封面保存目录</p>
            </div>
            <div class="row">
              <input
                id="av-custom-cover-dir"
                v-model="customCoverDir"
                class="input"
                type="text"
                placeholder="或输入自定义目录路径"
                @keyup.enter="pickCoverFile(customCoverDir)"
              />
              <button type="button" class="btn btn--sm" :disabled="!customCoverDir.trim()" @click="pickCoverFile(customCoverDir)">
                使用此目录
              </button>
            </div>
          </div>
        </div>

        <!-- 演员：全量列表已在打开时取回，这里只做本地筛选 -->
        <div class="field">
          <label for="av-actor-search">演员</label>
          <div class="panel actor-box">
            <div v-if="selectedActors.length" class="tag-row">
              <span v-for="actor in selectedActors" :key="actor.id" class="tag tag--accent">
                {{ actor.name }}
                <button type="button" class="tag__x" :aria-label="'移除 ' + actor.name" @click="removeActor(actor.id)">
                  &times;
                </button>
              </span>
            </div>
            <div class="actor-search">
              <input
                id="av-actor-search"
                v-model="actorSearch"
                class="input"
                type="text"
                placeholder="搜索演员并添加"
                autocomplete="off"
                @input="onActorSearchInput"
              />
              <ul v-if="actorCandidates.length" class="suggest">
                <li v-for="actor in actorCandidates" :key="actor.id" class="suggest__item">
                  <button type="button" @mousedown.prevent="addActor(actor)">{{ actor.name }}</button>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <!-- 隐藏的文件选择器：只为按钮触发，不进 Tab 顺序 -->
        <input ref="videoFileInputRef" type="file" accept="video/*" class="file-picker" @change="onVideoFileSelected" />
        <input ref="coverFileInputRef" type="file" accept="image/*" class="file-picker" @change="onCoverFileSelected" />
      </div>
    </template>

    <template #extra-actions>
      <button v-if="editingVideo" type="button" class="btn btn--danger btn--sm foot-left" @click="handleDelete">
        删除
      </button>
      <button v-else type="button" class="btn btn--sm foot-left" @click="handleSaveContinue">连续添加</button>
    </template>
  </Dialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { videoApi, actorApi, scanDirectoryApi, uploadApi } from '@/scripts/api'
import { useUiStore, errText } from '@/scripts/store/ui'
import { formatSize } from '@/scripts/utils/format'
import { debounce } from '@/scripts/utils/debounce'
import Dialog from './Dialog.vue'
import ComboBox from './ComboBox.vue'
import SelectList from './SelectList.vue'
import { toOptions } from '@/scripts/utils/options'

const props = defineProps({
  visible: Boolean,
  editingVideo: Object
})

const ui = useUiStore()

const emit = defineEmits(['save', 'save-continue', 'cancel', 'delete'])

// 后端 Paging.MaxPageSize，单次能取回的上限
const ACTOR_FETCH_SIZE = 500
const SUGGEST_LIMIT = 20

const actorList = ref([])
const selectedActors = ref([])
const actorSearch = ref('')
// 本地这一页筛不出来时才用它兜底（演员总数超过 ACTOR_FETCH_SIZE）
const remoteActors = ref([])
const codeLoading = ref(false)
const meta = ref({ categories: [], countries: [], series: [] })
const scanDirectories = ref([])

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

const countryOptions = computed(() => toOptions(meta.value.countries, form.value.country))

const categoryOptions = computed(() => toOptions(meta.value.categories, form.value.category))

// meta 已经是 [{ id, name }]，直接给 ComboBox
const seriesOptions = computed(() => meta.value.series || [])

const videoDirs = computed(() => scanDirectories.value.filter((d) => d.category === '视频'))
const coverDirs = computed(() => scanDirectories.value.filter((d) => d.category === '封面'))

/* ---------------------------------------------------------------
   路径推导：{目录}/{番号}.{扩展名}，封面目录由视频目录推导
   --------------------------------------------------------------- */

const trimEnd = (dir) => (dir || '').replace(/[\\/]+$/, '')

// /x/video 与 /x/video/y 里的 video 段换成 cover
const toCoverDir = (dir) => (dir || '').replace(/[\\/]video(?=$|[\\/])/i, '/cover')

const mediaPath = (dir, code, ext) => `${trimEnd(dir)}/${code}.${ext}`

const fillVideoPath = () => {
  if (!form.value.code) {
    ui.warn('请先填写番号')
    return
  }
  if (videoDirs.value.length === 0) {
    ui.warn('没有配置视频保存目录')
    return
  }
  form.value.filePath = mediaPath(videoDirs.value[0].path, form.value.code, 'mp4')
}

const fillCoverPath = () => {
  if (!form.value.code) {
    ui.warn('请先填写番号')
    return
  }
  if (coverDirs.value.length > 0) {
    form.value.coverPath = mediaPath(coverDirs.value[0].path, form.value.code, 'jpg')
    return
  }
  // 没有封面目录，从视频目录推导
  if (videoDirs.value.length > 0) {
    form.value.coverPath = mediaPath(toCoverDir(videoDirs.value[0].path), form.value.code, 'jpg')
  } else {
    ui.warn('没有配置封面保存目录')
  }
}

/* ---------------------------------------------------------------
   上传
   --------------------------------------------------------------- */

const loadScanDirectories = async () => {
  try {
    const res = await scanDirectoryApi.getList()
    if (res.success) {
      scanDirectories.value = res.data || []
    }
  } catch (e) {
    console.error('加载文件目录失败:', e)
  }
}

const showVideoUploadDir = () => {
  showVideoDirDropdown.value = !showVideoDirDropdown.value
  showCoverDirDropdown.value = false
  customVideoDir.value = ''
}

const showCoverUploadDir = () => {
  showCoverDirDropdown.value = !showCoverDirDropdown.value
  showVideoDirDropdown.value = false
  customCoverDir.value = ''
}

const pickVideoFile = (dir) => {
  if (!dir) return
  pendingUploadDir.value = dir
  showVideoDirDropdown.value = false
  videoFileInputRef.value?.click()
}

const pickCoverFile = (dir) => {
  if (!dir) return
  pendingUploadDir.value = toCoverDir(dir)
  showCoverDirDropdown.value = false
  coverFileInputRef.value?.click()
}

const onVideoFileSelected = async (e) => {
  const file = e.target.files?.[0]
  if (!file) return
  await doUpload('video', pendingUploadDir.value, file)
  e.target.value = '' // 清空，支持重复选择同一文件
}

const onCoverFileSelected = async (e) => {
  const file = e.target.files?.[0]
  if (!file) return
  await doUpload('cover', pendingUploadDir.value, file)
  e.target.value = ''
}

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
      ui.error('上传失败：' + errText(res, '未知错误'))
    }
  } catch (err) {
    console.error('上传失败:', err)
    ui.error('上传失败：' + errText(err))
  } finally {
    uploading.value = false
    uploadTarget.value = ''
    uploadProgress.value = 0
    uploadingFileName.value = ''
    pendingUploadDir.value = ''
  }
}

/* ---------------------------------------------------------------
   演员选择
   --------------------------------------------------------------- */

const actorRows = (data) => (Array.isArray(data) ? data : data?.list || [])

const candidate = (actor, keyword, picked) =>
  !picked.has(actor.id) && (actor.name || '').toLowerCase().includes(keyword)

const actorCandidates = computed(() => {
  const kw = actorSearch.value.trim().toLowerCase()
  if (!kw) return []
  const picked = new Set(selectedActors.value.map((a) => a.id))
  const local = actorList.value.filter((a) => candidate(a, kw, picked))
  // 演员总数没超过单次取回上限时根本不会发请求，本地这份就是全集
  if (local.length || actorList.value.length < ACTOR_FETCH_SIZE) return local.slice(0, SUGGEST_LIMIT)
  return remoteActors.value.filter((a) => candidate(a, kw, picked)).slice(0, SUGGEST_LIMIT)
})

// 本地筛不出来（列表被 500 条截断）才退回服务端，并且停顿后再查，不再每敲一个字打一次接口
const searchRemoteActors = debounce(async (kw) => {
  if (!kw || actorList.value.length < ACTOR_FETCH_SIZE) {
    remoteActors.value = []
    return
  }
  try {
    const res = await actorApi.getList({ keyword: kw, pageSize: 50 })
    if (actorSearch.value.trim() !== kw) return // 关键词已经变了
    const picked = new Set(selectedActors.value.map((a) => a.id))
    remoteActors.value = actorRows(res.data).filter((a) => candidate(a, kw.toLowerCase(), picked))
  } catch (error) {
    console.error('搜索演员失败:', error)
    remoteActors.value = []
  }
}, 400)

const onActorSearchInput = () => {
  searchRemoteActors(actorSearch.value.trim())
}

const addActor = (actor) => {
  if (!selectedActors.value.some((a) => a.id === actor.id)) {
    selectedActors.value.push(actor)
  }
  actorSearch.value = ''
  searchRemoteActors.cancel()
  remoteActors.value = []
}

const removeActor = (actorId) => {
  selectedActors.value = selectedActors.value.filter((a) => a.id !== actorId)
}

/* ---------------------------------------------------------------
   数据加载与提交
   --------------------------------------------------------------- */

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
    const res = await actorApi.getList({ page: 1, pageSize: ACTOR_FETCH_SIZE })
    if (res.success) {
      actorList.value = actorRows(res.data)
    }
  } catch (error) {
    console.error('加载演员列表失败:', error)
  }
}

watch(() => props.visible, async (val) => {
  if (!val) return
  showVideoDirDropdown.value = false
  showCoverDirDropdown.value = false
  resetActors()

  await Promise.all([loadMeta(), loadActorList(), loadScanDirectories()])
  if (!props.editingVideo) {
    resetForm()
    return
  }
  try {
    const detail = await videoApi.getDetail(props.editingVideo.id)
    if (!detail.success || !detail.data) return
    const { video } = detail.data
    form.value = {
      name: video.name || '',
      code: video.code || '',
      category: video.category || '',
      country: video.country || '',
      seriesId: video.seriesId || '',
      filePath: video.filePath || '',
      coverPath: video.coverPath || ''
    }
    selectedActors.value = detail.data.actors || []
    // 编辑值不在已有选项里时，直接落到手填输入框，免得看起来像没选
  } catch (e) {
    console.error('加载影片详情失败', e)
  }
})

const resetForm = () => {
  form.value = { name: '', code: '', category: '', country: '', seriesId: '', filePath: '', coverPath: '', fileSize: null }
  resetActors()
}

const resetActors = () => {
  actorSearch.value = ''
  remoteActors.value = []
  searchRemoteActors.cancel()
  selectedActors.value = []
}

const handleSave = () => {
  if (!form.value.name.trim()) {
    ui.warn('请输入影片名称')
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
    actorIds: selectedActors.value.map((a) => a.id)
  })
}

const handleSaveContinue = () => {
  if (!form.value.name.trim()) {
    ui.warn('请输入影片名称')
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
    actorIds: selectedActors.value.map((a) => a.id)
  })
  // 清空番号、视频路径、封面路径、演员
  form.value.code = ''
  form.value.filePath = ''
  form.value.coverPath = ''
  form.value.fileSize = null
  resetActors()
}

const handleCancel = () => {
  emit('cancel')
}

const handleDelete = () => {
  emit('delete', props.editingVideo?.id)
}
</script>

<style scoped>
.form {
  display: flex;
  flex-direction: column;
  gap: var(--s4);
}

/* 文件选择器只由按钮 .click() 触发，不占位也不进 Tab 顺序 */
.file-picker {
  display: none;
}

.field > .field__label {
  font-size: var(--f-sm);
  color: var(--text-dim);
}

.req {
  color: var(--danger);
}

.row {
  display: flex;
  align-items: center;
  gap: var(--s2);
}

.row > .input {
  flex: 1;
  min-width: 0;
}

.row--two {
  align-items: flex-start;
}

.row--two > .field {
  flex: 1;
  min-width: 0;
}

.switch {
  align-self: flex-start;
  font-size: var(--f-xs);
  color: var(--accent);
}

.switch:hover {
  text-decoration: underline;
}

.hint {
  font-size: var(--f-xs);
  color: var(--text-faint);
}

.foot-left {
  margin-right: auto;
}

/* 上传进度 */
.progress {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.progress__bar {
  height: 6px;
  border-radius: var(--rp);
  background: var(--bg-elev-2);
  overflow: hidden;
}

.progress__fill {
  height: 100%;
  border-radius: var(--rp);
  background: var(--accent);
  transition: width var(--dur) var(--ease);
}

.progress__text {
  font-size: var(--f-xs);
  color: var(--text-dim);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 目录选择面板 */
.dir-panel {
  display: flex;
  flex-direction: column;
  gap: var(--s2);
  padding: var(--s3);
}

.dir-panel__head {
  font-size: var(--f-sm);
  color: var(--text-dim);
}

.dir-panel__list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 160px;
  overflow-y: auto;
}

.dir-panel__item {
  text-align: left;
  padding: 5px 8px;
  border-radius: var(--r1);
  font-size: var(--f-sm);
  color: var(--text-dim);
  word-break: break-all;
}

.dir-panel__item:hover {
  background: var(--bg-hover);
  color: var(--text);
}

/* 演员 */
.actor-box {
  display: flex;
  flex-direction: column;
  gap: var(--s2);
  padding: var(--s3);
}

.tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s2);
}

.tag__x {
  display: grid;
  place-items: center;
  font-size: var(--f-md);
  line-height: 1;
  color: inherit;
  opacity: .7;
}

.tag__x:hover {
  opacity: 1;
  color: var(--danger);
}

.actor-search {
  position: relative;
}

.suggest {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  z-index: 30;
  list-style: none;
  padding: 4px;
  max-height: 220px;
  overflow-y: auto;
  background: var(--bg-elev);
  border: 1px solid var(--border-strong);
  border-radius: var(--r1);
  box-shadow: var(--shadow-2);
}

.suggest__item button {
  display: block;
  width: 100%;
  text-align: left;
  padding: 6px 9px;
  border-radius: var(--r1);
  font-size: var(--f-md);
  color: var(--text-dim);
}

.suggest__item button:hover {
  background: var(--bg-hover);
  color: var(--text);
}
</style>
