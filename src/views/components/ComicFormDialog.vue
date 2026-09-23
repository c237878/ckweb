<template>
  <Dialog
    :visible="visible"
    :title="editingComic ? '编辑漫画' : '添加漫画'"
    @cancel="requestClose"
  >
    <template #content>
      <form class="comic-form" @submit.prevent="handleConfirm">
        <div class="form-row">
          <div class="field">
            <label for="cf-name">名称 <span class="required">*</span></label>
            <input
              id="cf-name"
              v-model.trim="draft.name"
              class="input"
              type="text"
              placeholder="输入漫画名称"
              maxlength="100"
              required
            />
          </div>
          <div class="field">
            <label for="cf-author">作者</label>
            <input
              id="cf-author"
              v-model="draft.author"
              class="input"
              type="text"
              placeholder="输入作者名称"
              maxlength="50"
            />
          </div>
        </div>

        <div class="field">
          <label for="cf-description">介绍</label>
          <textarea
            id="cf-description"
            v-model="draft.description"
            class="textarea"
            placeholder="简单描述漫画内容..."
            rows="3"
            maxlength="500"
          ></textarea>
        </div>

        <div class="field">
          <label for="cf-url">外链</label>
          <input
            id="cf-url"
            v-model="draft.url"
            class="input"
            type="url"
            placeholder="https://example.com/comic/123"
          />
          <span class="form-hint">填写后卡片右上角显示外链入口</span>
        </div>

        <div class="field">
          <label for="cf-cover-path">封面路径</label>
          <input
            id="cf-cover-path"
            v-model="draft.coverPath"
            class="input"
            type="text"
            placeholder="C:\Comics\OnePiece\cover.jpg"
          />
          <div v-if="draft.coverPath" class="cover-preview">
            <img
              v-if="!coverPreviewError"
              :src="coverPreviewUrl"
              alt="封面预览"
              @error="coverPreviewError = true"
              @load="coverPreviewError = false"
            />
            <span v-else class="cover-preview-error">无法加载封面</span>
          </div>
        </div>

        <div class="field">
          <label for="cf-directory">漫画目录</label>
          <input
            id="cf-directory"
            v-model="draft.directory"
            class="input"
            type="text"
            placeholder="章节图片所在根目录"
          />
          <span class="form-hint">章节扫描将以此目录为基础路径</span>
        </div>

        <div class="field">
          <label>状态</label>
          <SelectList
            v-model="draft.status"
            :options="COMIC_STATUS_OPTIONS"
            label="连载状态"
          />
        </div>
      </form>
    </template>

    <template #actions>
      <button type="button" class="btn btn--ghost" @click="requestClose">取消</button>
      <button type="button" class="btn btn--primary" :disabled="saving" @click="handleConfirm">
        <span v-if="saving" class="spinner" aria-hidden="true"></span>
        {{ saving ? '保存中...' : '保存' }}
      </button>
    </template>
  </Dialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import Dialog from '@/views/components/Dialog.vue'
import SelectList from '@/views/components/SelectList.vue'
import { COMIC_STATUS_OPTIONS } from '@/scripts/constants'
import { comicApi } from '@/scripts/api'
import { useUiStore } from '@/scripts/store/ui'

const props = defineProps({
  visible: Boolean,
  editingComic: Object,  // null = 添加模式
  saving: Boolean        // 由父组件的请求状态驱动：本组件只 emit，不知道请求何时结束
})

const emit = defineEmits(['update:visible', 'save', 'cancel'])

const ui = useUiStore()

const coverPreviewError = ref(false)

// 表单草稿
const draft = ref({
  name: '',
  author: '',
  description: '',
  url: '',
  coverPath: '',
  directory: '',
  status: 0
})

const coverPreviewUrl = computed(() => {
  return draft.value.coverPath ? comicApi.getCoverUrl(draft.value.coverPath) : ''
})

const emptyDraft = () => ({
  name: '', author: '', description: '', url: '', coverPath: '', directory: '', status: 0
})

// 遮罩、Esc、焦点归还由 Dialog 统一处理，这里只把关闭动作转给父组件
const requestClose = () => {
  emit('cancel')
  emit('update:visible', false)
}

// 同步 editingComic → draft
watch(() => props.visible, (val) => {
  if (!val) return
  coverPreviewError.value = false
  draft.value = props.editingComic
    ? {
        name: props.editingComic.name || '',
        author: props.editingComic.author || '',
        description: props.editingComic.description || '',
        url: props.editingComic.url || '',
        coverPath: props.editingComic.coverPath || '',
        directory: props.editingComic.directory || '',
        status: props.editingComic.status || 0
      }
    : emptyDraft()
}, { immediate: true })

// 封面路径变化时重置错误状态
watch(() => draft.value.coverPath, () => {
  coverPreviewError.value = false
})

const handleConfirm = () => {
  if (!draft.value.name?.trim()) {
    ui.warn('名称不能为空')
    return
  }
  emit('save', { ...draft.value, name: draft.value.name.trim() })
}
</script>

<style scoped>
/* 布局：两列一行 + 字段间距，其余走 main.css 的 .dialog/.field/.input */
.comic-form {
  display: flex;
  flex-direction: column;
  gap: var(--s3);
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--s3);
}

.required {
  color: var(--danger);
}

.form-hint {
  font-size: var(--f-xs);
  color: var(--text-faint);
  line-height: 1.4;
}

.cover-preview {
  display: flex;
  align-items: center;
  justify-content: center;
  max-height: 120px;
  border: 1px solid var(--border);
  border-radius: var(--r1);
  background: var(--bg-input);
  overflow: hidden;
}

.cover-preview img {
  max-width: 100%;
  max-height: 120px;
  object-fit: cover;
}

.cover-preview-error {
  padding: var(--s3);
  font-size: var(--f-xs);
  color: var(--text-faint);
}

@media (max-width: 480px) {
  .form-row {
    grid-template-columns: 1fr;
  }
}
</style>
