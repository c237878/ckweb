<template>
  <Dialog :visible="visible" :title="editingVideo ? '编辑影片' : '添加影片'" @confirm="handleSave" @cancel="handleCancel">
    <template #content>
      <div class="form-item">
        <label>番号</label>
        <input v-model="form.code" type="text" placeholder="如: ABC-123" />
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
      <div class="form-item">
        <label>视频路径</label>
        <input v-model="form.filePath" type="text" placeholder="视频文件完整路径（如 /Volumes/disk1/movies/...）" />
      </div>
      <div class="form-item">
        <label>封面路径</label>
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
import { ref, computed, watch } from 'vue'
import { videoApi, actorApi } from '@/scripts/api'
import Dialog from './Dialog.vue'

const props = defineProps({
  visible: Boolean,
  editingVideo: Object
})

const emit = defineEmits(['save', 'cancel', 'delete'])

const actorList = ref([])
const selectedActors = ref([])
const actorSearch = ref('')
const matchedActors = ref([])
const meta = ref({ categories: [], countries: [], series: [] })

const showCatDropdown = ref(false)
const showCountryDropdown = ref(false)
const showSeriesDropdown = ref(false)

const seriesInput = ref('')

const seriesList = computed(() => meta.value.series || [])

const filteredCategories = computed(() => {
  if (showCatDropdown.value) return meta.value.categories || []
  if (!form.value.category) return meta.value.categories || []
  return (meta.value.categories || []).filter(c => c.includes(form.value.category))
})

const filteredCountries = computed(() => {
  if (showCountryDropdown.value) return meta.value.countries || []
  if (!form.value.country) return meta.value.countries || []
  return (meta.value.countries || []).filter(c => c.includes(form.value.country))
})

const filteredSeries = computed(() => {
  if (showSeriesDropdown.value) return seriesList.value
  if (!seriesInput.value) return seriesList.value
  return seriesList.value.filter(s => s.name.includes(seriesInput.value))
})

const form = ref({
  name: '',
  code: '',
  category: '',
  country: '',
  seriesId: '',
  filePath: '',
  coverPath: ''
})

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
      // 如果输入了文字但没选中已有系列，则清空seriesId（允许自由输入，但seriesId只有选中已有才有效）
      const matched = seriesList.value.find(s => s.name === seriesInput.value)
      if (matched) {
        form.value.seriesId = matched.id
      } else {
        // 自由输入不对应已有系列ID，保持seriesId为空
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
    await Promise.all([loadMeta(), loadActorList()])
    if (props.editingVideo) {
      form.value = {
        name: props.editingVideo.name || '',
        code: props.editingVideo.code || '',
        category: props.editingVideo.category || '',
        country: props.editingVideo.country || '',
        seriesId: props.editingVideo.seriesId || '',
        filePath: props.editingVideo.filePath || props.editingVideo.videoUrl || '',
        coverPath: props.editingVideo.coverPath || props.editingVideo.coverUrl || ''
      }
      // 设置系列输入框显示名称
      if (props.editingVideo.seriesId && props.editingVideo.seriesName) {
        seriesInput.value = props.editingVideo.seriesName
      } else {
        seriesInput.value = ''
      }
      // 编辑时从 detail 接口加载完整数据（含演员）
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
  form.value = {
    name: '',
    code: '',
    category: '',
    country: '',
    seriesId: '',
    filePath: '',
    coverPath: ''
  }
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
    actorIds: selectedActors.value.map(a => a.id)
  })
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
</style>
