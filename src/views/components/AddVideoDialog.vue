<template>
  <Dialog :visible="visible" :title="editingVideo ? '编辑影片' : '添加影片'" @confirm="handleSave" @cancel="handleCancel">
    <template #content>
      <div class="form-item">
        <label>名称 *</label>
        <input v-model="form.name" type="text" placeholder="影片名称（必填）" />
      </div>
      <div class="form-item">
        <label>分类</label>
        <div class="combobox-wrap">
          <input v-model="form.category" type="text" list="cat-list" placeholder="选择或输入分类" />
          <datalist id="cat-list">
            <option v-for="c in meta.categories" :key="c" :value="c" />
          </datalist>
        </div>
      </div>
      <div class="form-item">
        <label>国家</label>
        <div class="combobox-wrap">
          <input v-model="form.country" type="text" list="country-list" placeholder="选择或输入国家" />
          <datalist id="country-list">
            <option v-for="c in meta.countries" :key="c" :value="c" />
          </datalist>
        </div>
      </div>
      <div class="form-item">
        <label>所属Samba目录</label>
        <select v-model="form.sambaDir" @change="onSambaDirChange">
          <option value="">未选择</option>
          <option v-for="samba in sambaList" :key="samba.id" :value="samba.path">{{ samba.name }} ({{ samba.path }})</option>
        </select>
      </div>
      <div class="form-item">
        <label>文件路径</label>
        <input v-model="form.filePath" type="text" placeholder="视频文件完整路径（如 /Volumes/disk1/movies/...）" />
      </div>
      <div class="form-item">
        <label>封面图片路径</label>
        <input v-model="form.coverPath" type="text" placeholder="封面图片路径（选填，如 /Volumes/disk1/cover.jpg）" />
      </div>
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
    </template>
    <template #actions>
      <button v-if="editingVideo" class="delete-btn" @click="handleDelete">删除</button>
    </template>
  </Dialog>
</template>

<script setup>
import { ref, watch } from 'vue'
import { videoApi, actorApi, sambaApi } from '@/scripts/api'
import Dialog from './Dialog.vue'

const props = defineProps({
  visible: Boolean,
  editingVideo: Object
})

const emit = defineEmits(['save', 'cancel', 'delete'])

const sambaList = ref([])
const actorList = ref([])
const selectedActors = ref([])
const actorSearch = ref('')
const matchedActors = ref([])
const meta = ref({ categories: [], countries: [] })

const form = ref({
  name: '',
  category: '',
  country: '',
  filePath: '',
  coverPath: '',
  sambaDir: ''
})

watch(() => props.visible, async (newVal) => {
  if (newVal) {
    await Promise.all([loadActors(), loadSambaList(), loadMeta()])
    if (props.editingVideo) {
      form.value = {
        name: props.editingVideo.name || '',
        category: props.editingVideo.category || '',
        country: props.editingVideo.country || '',
        filePath: props.editingVideo.filePath || '',
        coverPath: props.editingVideo.coverPath || '',
        sambaDir: props.editingVideo.sambaDir || ''
      }
      await loadVideoActors(props.editingVideo.id)
    } else {
      resetForm()
    }
  }
})

const loadMeta = async () => {
  try {
    const res = await videoApi.getMeta()
    if (res.success) {
      meta.value = res
    }
  } catch (e) {
    console.error('加载元数据失败', e)
  }
}

const loadActors = async () => {
  try {
    const res = await actorApi.getList({ page: 1, pageSize: 1000 })
    if (res.success) actorList.value = res.data || []
  } catch (e) {
    console.error('加载演员失败:', e)
  }
}

const loadSambaList = async () => {
  try {
    const res = await sambaApi.getList()
    if (res.success) sambaList.value = res.data || []
  } catch (e) {
    console.error('加载Samba列表失败:', e)
  }
}

const loadVideoActors = async (videoId) => {
  try {
    const res = await videoApi.getDetail(videoId)
    if (res.success && res.data && res.data.video) {
      form.value.name = res.data.video.name || res.data.video.title || ''
      form.value.category = res.data.video.category || ''
      form.value.country = res.data.video.country || ''
      form.value.filePath = res.data.video.filePath || ''
      form.value.coverPath = res.data.video.coverPath || res.data.video.cover_path || ''
      form.value.sambaDir = res.data.video.sambaDir || res.data.video.samba_dir || ''
      selectedActors.value = res.data.actors || []
    }
  } catch (e) {
    console.error('加载视频演员失败:', e)
  }
}

const onSambaDirChange = () => {
  if (!form.value.sambaDir) return
  form.value.filePath = form.value.sambaDir + '/'
  // 自动推导封面路径：同目录同名 .jpg
  if (form.value.filePath.endsWith('/')) {
    // 留空，让用户手动填或后续扩展
  }
}

const searchActors = () => {
  if (!actorSearch.value) { matchedActors.value = []; return }
  const kw = actorSearch.value.toLowerCase()
  matchedActors.value = actorList.value.filter(a =>
    !selectedActors.value.find(s => s.id === a.id) &&
    a.name.toLowerCase().includes(kw)
  ).slice(0, 10)
}

const addActor = (actor) => {
  if (!selectedActors.value.find(a => a.id === actor.id)) selectedActors.value.push(actor)
  actorSearch.value = ''
  matchedActors.value = []
}

const removeActor = (actorId) => {
  selectedActors.value = selectedActors.value.filter(a => a.id !== actorId)
}

const resetForm = () => {
  form.value = { name: '', category: '', country: '', filePath: '', coverPath: '', sambaDir: '' }
  selectedActors.value = []
  actorSearch.value = ''
  matchedActors.value = []
}

const handleSave = () => {
  if (!form.value.name) { alert('请填写影片名称'); return }
  emit('save', {
    id: props.editingVideo?.id,
    title: form.value.name,
    category: form.value.category,
    country: form.value.country,
    filePath: form.value.filePath,
    coverPath: form.value.coverPath,
    sambaDir: form.value.sambaDir,
    actorIds: selectedActors.value.map(a => a.id)
  })
}

const handleCancel = () => { resetForm(); emit('cancel') }
const handleDelete = () => { if (props.editingVideo?.id) emit('delete', props.editingVideo.id) }
</script>

<style scoped>
.form-item { margin-bottom: 20px; }
.form-item label { display: block; margin-bottom: 8px; font-weight: bold; color: #333; }
.form-item input, .form-item select { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; }
.combobox-wrap { position: relative; }
.combobox-wrap input { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; }
.input-with-suggestions { position: relative; }
.suggestions { position: absolute; top: 100%; left: 0; right: 0; background: white; border: 1px solid #ddd; border-radius: 4px; max-height: 200px; overflow-y: auto; z-index: 10; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
.suggestion-item { padding: 10px; cursor: pointer; transition: background 0.2s; }
.suggestion-item:hover { background: #f5f5f5; }
.actor-selector { display: flex; flex-direction: column; gap: 10px; }
.selected-actors { display: flex; flex-wrap: wrap; gap: 8px; }
.actor-tag { display: inline-flex; align-items: center; gap: 5px; padding: 5px 12px; background: #3498db; color: white; border-radius: 15px; font-size: 13px; }
.remove-btn { background: none; border: none; color: white; font-size: 16px; cursor: pointer; padding: 0 5px; line-height: 1; }
.remove-btn:hover { opacity: 0.8; }
.delete-btn { padding: 10px 30px; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; background: #e74c3c; color: white; margin-right: auto; }
.delete-btn:hover { opacity: 0.8; }
</style>