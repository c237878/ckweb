<template>
  <Dialog :visible="visible" :title="editingVideo ? '编辑影片' : '添加影片'" @confirm="handleSave" @cancel="handleCancel">
    <template #content>
      <div class="form-item">
        <label>名称 *</label>
        <input v-model="form.name" type="text" placeholder="影片名称（必填）" />
      </div>
      <div class="form-item">
        <label>分类</label>
        <select v-model="form.category">
          <option value="电影">电影</option>
          <option value="电视剧">电视剧</option>
          <option value="动漫">动漫</option>
          <option value="其他">其他</option>
        </select>
      </div>
      <div class="form-item">
        <label>国家</label>
        <select v-model="form.country">
          <option value="">未选择</option>
          <option value="日本">日本</option>
          <option value="中国">中国</option>
          <option value="韩国">韩国</option>
          <option value="美国">美国</option>
          <option value="泰国">泰国</option>
          <option value="其他">其他</option>
        </select>
      </div>
      <div class="form-item">
        <label>所属Samba目录</label>
        <select v-model="form.sambaDir">
          <option value="">未选择</option>
          <option v-for="samba in sambaList" :key="samba.id" :value="samba.path">{{ samba.name }} ({{ samba.path }})</option>
        </select>
      </div>
      <div class="form-item">
        <label>文件路径</label>
        <input v-model="form.filePath" type="text" placeholder="视频文件完整路径（如 /Volumes/disk1/movies/...）" />
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
import { ref, watch, defineProps, defineEmits, onMounted } from 'vue'
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

const form = ref({
  name: '',
  category: '电影',
  country: '',
  filePath: '',
  sambaDir: ''
})

onMounted(async () => {
  await loadActors()
  await loadSambaList()
})

watch(() => props.visible, async (newVal) => {
  if (newVal) {
    await loadActors()
    await loadSambaList()
    if (props.editingVideo) {
      form.value = {
        name: props.editingVideo.name || '',
        category: props.editingVideo.category || '电影',
        country: props.editingVideo.country || '',
        filePath: props.editingVideo.filePath || ''
      }
      await loadVideoActors(props.editingVideo.id)
    } else {
      resetForm()
    }
  }
})

const loadActors = async () => {
  try {
    const res = await actorApi.getList({ page: 1, pageSize: 1000 })
    if (res.success) {
      actorList.value = res.data || []
    }
  } catch (error) {
    console.error('加载演员失败:', error)
  }
}

const loadSambaList = async () => {
  try {
    const res = await sambaApi.getList()
    if (res.success) {
      sambaList.value = res.data || []
    }
  } catch (error) {
    console.error('加载Samba列表失败:', error)
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
      form.value.sambaDir = res.data.video.sambaDir || ''
      selectedActors.value = res.data.actors || []
    }
  } catch (error) {
    console.error('加载视频演员失败:', error)
  }
}

const searchActors = () => {
  if (!actorSearch.value) {
    matchedActors.value = []
    return
  }
  const keyword = actorSearch.value.toLowerCase()
  matchedActors.value = actorList.value.filter(actor => 
    !selectedActors.value.find(a => a.id === actor.id) && (
      actor.name.toLowerCase().includes(keyword)
    )
  ).slice(0, 10)
}

const addActor = (actor) => {
  if (!selectedActors.value.find(a => a.id === actor.id)) {
    selectedActors.value.push(actor)
  }
  actorSearch.value = ''
  matchedActors.value = []
}

const removeActor = (actorId) => {
  selectedActors.value = selectedActors.value.filter(a => a.id !== actorId)
}

const resetForm = () => {
  form.value = {
    name: '',
    category: '电影',
    country: '',
    filePath: '',
    sambaDir: ''
  }
  selectedActors.value = []
  actorSearch.value = ''
  matchedActors.value = []
}

const handleSave = () => {
  if (!form.value.name) {
    alert('请填写影片名称')
    return
  }
  
  const formData = {
    title: form.value.name,
    category: form.value.category,
    country: form.value.country,
    filePath: form.value.filePath,
    sambaDir: form.value.sambaDir,
    actorIds: selectedActors.value.map(a => a.id)
  }
  
  emit('save', { id: props.editingVideo?.id, ...formData })
}

const handleCancel = () => {
  resetForm()
  emit('cancel')
}

const handleDelete = () => {
  if (props.editingVideo && props.editingVideo.id) {
    emit('delete', props.editingVideo.id)
  }
}
</script>

<style scoped>
.form-item {
  margin-bottom: 20px;
}

.form-item label {
  display: block;
  margin-bottom: 8px;
  font-weight: bold;
  color: #333;
}

.form-item input,
.form-item select {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.input-with-suggestions {
  position: relative;
}

.suggestions {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: white;
  border: 1px solid #ddd;
  border-radius: 4px;
  max-height: 200px;
  overflow-y: auto;
  z-index: 10;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.suggestion-item {
  padding: 10px;
  cursor: pointer;
  transition: background 0.2s;
}

.suggestion-item:hover {
  background: #f5f5f5;
}

.suggestion-item .alias {
  color: #999;
  font-size: 12px;
  margin-left: 5px;
}

.actor-selector {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.selected-actors {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.actor-tag {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 12px;
  background: #3498db;
  color: white;
  border-radius: 15px;
  font-size: 13px;
}

.remove-btn {
  background: none;
  border: none;
  color: white;
  font-size: 16px;
  cursor: pointer;
  padding: 0 5px;
  line-height: 1;
}

.remove-btn:hover {
  opacity: 0.8;
}

.delete-btn {
  padding: 10px 30px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: opacity 0.3s;
  background: #e74c3c;
  color: white;
  margin-right: auto;
}

.delete-btn:hover {
  opacity: 0.8;
}
</style>
