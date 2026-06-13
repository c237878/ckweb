<template>
  <Dialog :visible="visible" :title="editingVideo ? '编辑影片' : '添加影片'" @confirm="handleSave" @cancel="handleCancel">
    <template #content>
      <div class="form-item">
        <label>番号</label>
        <input v-model="form.code" type="text" placeholder="影片番号（可选）" />
      </div>
      <div class="form-item">
        <label>名称 *</label>
        <input v-model="form.name" type="text" placeholder="影片名称（必填）" />
      </div>
      <div class="form-item">
        <label>类型</label>
        <div class="input-with-suggestions">
          <input 
            v-model="form.country" 
            type="text" 
            placeholder="选择或输入国家"
            @input="filterCountries"
            @focus="showCountrySuggestions = true"
            @blur="hideCountrySuggestions"
          />
          <div v-if="showCountrySuggestions && filteredCountries.length > 0" class="suggestions">
            <div 
              v-for="country in filteredCountries" 
              :key="country" 
              class="suggestion-item"
              @mousedown="selectCountry(country)"
            >
              {{ country }}
            </div>
          </div>
        </div>
      </div>
      <div class="form-item">
        <label>所属系列</label>
        <div class="input-with-suggestions">
          <input 
            v-model="form.seriesName" 
            type="text" 
            placeholder="输入系列名称（自动匹配）"
            @input="matchSeries"
            @focus="showSeriesSuggestions = true"
            @blur="hideSeriesSuggestions"
          />
          <div v-if="showSeriesSuggestions && matchedSeries.length > 0" class="suggestions">
            <div 
              v-for="series in matchedSeries" 
              :key="series.id" 
              class="suggestion-item"
              @mousedown="selectSeries(series)"
            >
              {{ series.name }}
            </div>
          </div>
        </div>
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
              @focus="showActorSuggestions = true"
              @blur="hideActorSuggestions"
            />
            <div v-if="showActorSuggestions && matchedActors.length > 0" class="suggestions">
              <div 
                v-for="actor in matchedActors" 
                :key="actor.id" 
                class="suggestion-item"
                @mousedown="addActor(actor)"
              >
                {{ actor.name }}
                <span v-if="actor.alias" class="alias">({{ actor.alias }})</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="form-item">
        <label>封面图地址</label>
        <input v-model="form.coverUrl" type="url" placeholder="封面相对路径（如 /libsF/封面图/xxx.jpg）" />
      </div>
      <div class="form-item">
        <label>视频地址</label>
        <input v-model="form.videoUrl" type="url" placeholder="视频相对路径（如 /libsF/视频库/xxx.mp4）" />
      </div>
      <div class="form-item">
        <label>视频大小（字节）</label>
        <input v-model.number="form.videoSize" type="number" placeholder="视频文件大小" />
      </div>
      <div class="form-item">
        <label>画质标记</label>
        <div class="input-with-suggestions">
          <input 
            v-model="form.quality" 
            type="text" 
            placeholder="选择或输入画质"
            @input="filterQualities"
            @focus="showQualitySuggestions = true"
            @blur="hideQualitySuggestions"
          />
          <div v-if="showQualitySuggestions && filteredQualities.length > 0" class="suggestions">
            <div 
              v-for="quality in filteredQualities" 
              :key="quality" 
              class="suggestion-item"
              @mousedown="selectQuality(quality)"
            >
              {{ quality }}
            </div>
          </div>
        </div>
      </div>
      <div class="form-item">
        <label>排序序号</label>
        <input v-model.number="form.sortOrder" type="number" placeholder="数字越小越靠前" />
      </div>
    </template>
    <template #actions>
      <button v-if="editingVideo" class="delete-btn" @click="handleDelete">删除</button>
    </template>
  </Dialog>
</template>

<script setup>
import { ref, watch, defineProps, defineEmits, onMounted } from 'vue'
import { seriesApi, videoApi, actorApi, videoActorApi } from '@/scripts/api'
import Dialog from './Dialog.vue'

const props = defineProps({
  visible: Boolean,
  editingVideo: Object
})

const emit = defineEmits(['save', 'cancel', 'delete'])

const seriesList = ref([])
const actorList = ref([])
const existingCountries = ref([])
const existingQualities = ref([])
const selectedActors = ref([])
const actorSearch = ref('')

const form = ref({
  code: '',
  name: '',
  country: '',
  seriesId: '',
  seriesName: '',
  coverUrl: '',
  videoUrl: '',
  videoSize: 0,
  quality: '',
  sortOrder: 0
})

const showCountrySuggestions = ref(false)
const filteredCountries = ref([])
const showSeriesSuggestions = ref(false)
const matchedSeries = ref([])
const showActorSuggestions = ref(false)
const matchedActors = ref([])
const showQualitySuggestions = ref(false)
const filteredQualities = ref([])

onMounted(async () => {
  await Promise.all([
    loadSeries(),
    loadActors(),
    loadExistingCountries(),
    loadExistingQualities()
  ])
})

watch(() => props.visible, async (newVal) => {
  if (newVal) {
    await Promise.all([
      loadSeries(),
      loadActors(),
      loadExistingCountries(),
      loadExistingQualities()
    ])
    if (props.editingVideo) {
      // 编辑模式：复制数据到表单
      form.value = {
        code: props.editingVideo.code || '',
        name: props.editingVideo.name || '',
        country: props.editingVideo.country || '',
        seriesId: props.editingVideo.seriesId || '',
        seriesName: getSeriesName(props.editingVideo.seriesId),
        coverUrl: props.editingVideo.coverUrl || '',
        videoUrl: props.editingVideo.videoUrl || '',
        videoSize: props.editingVideo.videoSize || 0,
        quality: props.editingVideo.quality || '',
        sortOrder: props.editingVideo.sortOrder || 0
      }
      // 加载关联的演员
      await loadVideoActors(props.editingVideo.id)
    } else {
      resetForm()
    }
  }
})

const getSeriesName = (seriesId) => {
  if (!seriesId) return ''
  const series = seriesList.value.find(s => s.id === seriesId)
  return series ? series.name : ''
}

const loadSeries = async () => {
  try {
    const res = await seriesApi.getList({ page: 1, pageSize: 100 })
    if (res.success) {
      seriesList.value = res.data
    }
  } catch (error) {
    console.error('加载系列失败:', error)
  }
}

const loadActors = async () => {
  try {
    const res = await actorApi.getList({ page: 1, pageSize: 1000 })
    if (res.success) {
      actorList.value = res.data
    }
  } catch (error) {
    console.error('加载演员失败:', error)
  }
}

const loadVideoActors = async (videoId) => {
  try {
    const res = await videoActorApi.getActorsByVideo(videoId)
    if (res.success) {
      selectedActors.value = res.data
    }
  } catch (error) {
    console.error('加载视频演员失败:', error)
  }
}

const loadExistingCountries = async () => {
  try {
    const res = await videoApi.getList({ page: 1, pageSize: 1000 })
    if (res.success && res.data) {
      const countries = new Set()
      res.data.forEach(video => {
        if (video.country) countries.add(video.country)
      })
      existingCountries.value = Array.from(countries)
      filteredCountries.value = existingCountries.value
    }
  } catch (error) {
    console.error('加载类型列表失败:', error)
  }
}

const loadExistingQualities = async () => {
  try {
    const res = await videoApi.getList({ page: 1, pageSize: 1000 })
    if (res.success && res.data) {
      const qualities = new Set()
      res.data.forEach(video => {
        if (video.quality) qualities.add(video.quality)
      })
      existingQualities.value = Array.from(qualities)
      filteredQualities.value = existingQualities.value
    }
  } catch (error) {
    console.error('加载画质列表失败:', error)
  }
}

const filterCountries = () => {
  if (!form.value.country) {
    filteredCountries.value = existingCountries.value
  } else {
    filteredCountries.value = existingCountries.value.filter(c => 
      c.toLowerCase().includes(form.value.country.toLowerCase())
    )
  }
}

const selectCountry = (country) => {
  form.value.country = country
  showCountrySuggestions.value = false
}

const hideCountrySuggestions = () => {
  setTimeout(() => {
    showCountrySuggestions.value = false
  }, 200)
}

const matchSeries = () => {
  if (!form.value.seriesName) {
    matchedSeries.value = []
    form.value.seriesId = ''
    return
  }
  
  const input = form.value.seriesName.toLowerCase()
  matchedSeries.value = seriesList.value.filter(s => 
    s.name.toLowerCase().includes(input)
  )
  
  const exactMatch = seriesList.value.find(s => 
    s.name.toLowerCase() === input
  )
  if (exactMatch) {
    form.value.seriesId = exactMatch.id
  } else {
    form.value.seriesId = ''
  }
}

const selectSeries = (series) => {
  form.value.seriesId = series.id
  form.value.seriesName = series.name
  showSeriesSuggestions.value = false
}

const hideSeriesSuggestions = () => {
  setTimeout(() => {
    showSeriesSuggestions.value = false
  }, 200)
}

const searchActors = () => {
  if (!actorSearch.value) {
    matchedActors.value = []
    return
  }
  
  const input = actorSearch.value.toLowerCase()
  matchedActors.value = actorList.value.filter(actor => {
    // 已选中的不再显示
    if (selectedActors.value.find(a => a.id === actor.id)) return false
    // 匹配姓名或别名
    return actor.name.toLowerCase().includes(input) || 
           (actor.alias && actor.alias.toLowerCase().includes(input))
  })
}

const addActor = (actor) => {
  if (!selectedActors.value.find(a => a.id === actor.id)) {
    selectedActors.value.push(actor)
  }
  actorSearch.value = ''
  matchedActors.value = []
  showActorSuggestions.value = false
}

const removeActor = (actorId) => {
  selectedActors.value = selectedActors.value.filter(a => a.id !== actorId)
}

const hideActorSuggestions = () => {
  setTimeout(() => {
    showActorSuggestions.value = false
  }, 200)
}

const filterQualities = () => {
  if (!form.value.quality) {
    filteredQualities.value = existingQualities.value
  } else {
    filteredQualities.value = existingQualities.value.filter(q => 
      q.toLowerCase().includes(form.value.quality.toLowerCase())
    )
  }
}

const selectQuality = (quality) => {
  form.value.quality = quality
  showQualitySuggestions.value = false
}

const hideQualitySuggestions = () => {
  setTimeout(() => {
    showQualitySuggestions.value = false
  }, 200)
}

const resetForm = () => {
  form.value = {
    code: '',
    name: '',
    country: '',
    seriesId: '',
    seriesName: '',
    coverUrl: '',
    videoUrl: '',
    videoSize: 0,
    quality: '',
    sortOrder: 0
  }
  selectedActors.value = []
  actorSearch.value = ''
}

const handleSave = () => {
  if (!form.value.name) {
    alert('请填写影片名称')
    return
  }
  emit('save', { 
    ...form.value, 
    actorIds: selectedActors.value.map(a => a.id) 
  })
}

const handleCancel = () => {
  resetForm()
  emit('cancel')
}

const handleDelete = () => {
  if (confirm('确定要删除这个影片吗？此操作不可恢复！')) {
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
.form-item select,
.form-item textarea {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.form-item textarea {
  min-height: 80px;
  resize: vertical;
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
