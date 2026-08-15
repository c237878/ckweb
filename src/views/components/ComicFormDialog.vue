<template>
  <Dialog
    :visible="visible"
    :title="editingComic ? '编辑漫画' : '添加漫画'"
    @cancel="handleCancel"
    @confirm="handleConfirm"
  >
    <template #content>
      <div class="form-body">
        <!-- 基本信息区块 -->
        <section class="form-section">
          <div class="form-row form-row--two">
            <div class="form-group">
              <label>名称 <span class="required">*</span></label>
              <input
                v-model="draft.name"
                type="text"
                placeholder="输入漫画名称"
                class="input"
                maxlength="100"
              />
            </div>
            <div class="form-group">
              <label>作者</label>
              <input
                v-model="draft.author"
                type="text"
                placeholder="输入作者名称"
                class="input"
                maxlength="50"
              />
            </div>
          </div>

          <div class="form-group">
            <label>介绍</label>
            <textarea
              v-model="draft.description"
              placeholder="简单描述漫画内容..."
              class="input textarea"
              rows="3"
              maxlength="500"
              style="resize:none">
            </textarea>
          </div>
        </section>

        <!-- 链接信息区块 -->
        <section class="form-section">
          <div class="form-group">
            <label>外链</label>
            <div class="input-prefix-wrap">
              <span class="prefix-icon">🔗</span>
              <input
                v-model="draft.url"
                type="url"
                placeholder="https://example.com/comic/123"
                class="input input--prefix"
              />
            </div>
            <span class="form-hint">填写后卡片右上角显示外链入口</span>
          </div>
        </section>

        <!-- 文件路径区块 -->
        <section class="form-section">
          <div class="form-group">
            <label>封面路径</label>
            <input
              v-model="draft.coverPath"
              type="text"
              placeholder="C:\Comics\OnePiece\cover.jpg"
              class="input"
            />
            <div v-if="draft.coverPath" class="cover-preview">
              <img
                :src="coverPreviewUrl"
                @error="coverPreviewError = true"
                @load="coverPreviewError = false"
                v-if="!coverPreviewError"
                alt="封面预览"
              />
              <div v-else class="cover-preview-error">无法加载封面</div>
            </div>
          </div>

          <div class="form-group">
            <label>漫画目录</label>
            <input
              v-model="draft.directory"
              type="text"
              placeholder="章节图片所在根目录"
              class="input"
            />
            <span class="form-hint">章节扫描将以此目录为基础路径</span>
          </div>

          <div class="form-group">
            <label>状态</label>
            <select v-model.number="draft.status" class="input">
              <option :value="0">连载中</option>
              <option :value="1">完结</option>
            </select>
          </div>
        </section>
      </div>
    </template>

    <template #actions>
      <button type="button" class="btn btn--ghost" @click="handleCancel">取消</button>
      <button type="button" class="btn btn--primary" @click="handleConfirm" :disabled="saving">
        <span v-if="saving" class="btn-spinner"></span>
        {{ saving ? '保存中...' : '保存' }}
      </button>
    </template>
  </Dialog>
</template>

<script setup>
import { ref, watch, computed } from 'vue'
import Dialog from '@/views/components/Dialog.vue'
import { comicApi } from '@/scripts/api'

const props = defineProps({
  visible: Boolean,
  editingComic: Object  // null = 添加模式
})

const emit = defineEmits(['update:visible', 'save', 'cancel'])

const saving = ref(false)
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

// 封面预览 URL
const coverPreviewUrl = computed(() => {
  return draft.value.coverPath ? comicApi.getCoverUrl(draft.value.coverPath) : ''
})

// 同步 editingComic → draft
watch(() => props.visible, (val) => {
  if (val) {
    coverPreviewError.value = false
    if (props.editingComic) {
      draft.value = {
        name: props.editingComic.name || '',
        author: props.editingComic.author || '',
        description: props.editingComic.description || '',
        url: props.editingComic.url || '',
        coverPath: props.editingComic.coverPath || '',
        directory: props.editingComic.directory || '',
        status: props.editingComic.status || 0
      }
    } else {
      draft.value = { name: '', author: '', description: '', url: '', coverPath: '', directory: '', status: 0 }
    }
  }
})

// 封面路径变化时重置错误状态
watch(() => draft.value.coverPath, () => {
  coverPreviewError.value = false
})

const handleConfirm = async () => {
  if (!draft.value.name?.trim()) {
    alert('名称不能为空')
    return
  }
  saving.value = true
  try {
    emit('save', { ...draft.value })
  } finally {
    saving.value = false
  }
}

const handleCancel = () => {
  emit('cancel')
  emit('update:visible', false)
}
</script>

<style scoped>
/* ---------- 表单容器 ---------- */
.form-body {
  display: flex;
  flex-direction: column;
  gap: 0;
}

/* ---------- 分组区块 ---------- */
.form-section {
  padding-bottom: 20px;
  margin-bottom: 4px;
  border-bottom: 1px solid #f0f0f0;
}
.form-section:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

/* ---------- 行布局 ---------- */
.form-row {
  display: grid;
  gap: 16px;
}
.form-row--two {
  grid-template-columns: 1fr 1fr;
}

@media (max-width: 480px) {
  .form-row--two {
    grid-template-columns: 1fr;
  }
}

/* ---------- 字段 ---------- */
.form-group {
  display: flex;
  flex-direction: column;
  margin-bottom: 14px;
}
.form-group:last-child {
  margin-bottom: 0;
}

.form-group label {
  font-size: 13px;
  font-weight: 500;
  color: #374151;
  margin-bottom: 6px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.required {
  color: #ef4444;
  font-size: 14px;
}

/* ---------- 输入框 ---------- */
.input {
  width: 100%;
  box-sizing: border-box;
  padding: 9px 12px;
  border: 1.5px solid #e5e7eb;
  border-radius: 8px;
  font-size: 14px;
  color: #1f2937;
  background: #fafafa;
  transition: border-color 0.2s, background 0.2s, box-shadow 0.2s;
  outline: none;
  line-height: 1.5;
}

.input::placeholder {
  color: #9ca3af;
}

.input:focus {
  border-color: #60a5fa;
  background: #fff;
  box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.15);
}

.textarea {
  resize: vertical;
  min-height: 80px;
  line-height: 1.6;
}

/* ---------- 字数统计 ---------- */
.char-count {
  font-size: 11px;
  color: #9ca3af;
  text-align: right;
  margin-top: 4px;
}

/* ---------- 带前缀的输入框 ---------- */
.input-prefix-wrap {
  position: relative;
  display: flex;
  align-items: center;
}
.prefix-icon {
  position: absolute;
  left: 10px;
  font-size: 14px;
  pointer-events: none;
  z-index: 1;
}
.input--prefix {
  padding-left: 32px;
}

/* ---------- 提示文字 ---------- */
.form-hint {
  font-size: 11px;
  color: #9ca3af;
  margin-top: 5px;
  line-height: 1.4;
}

/* ---------- 封面预览 ---------- */
.cover-preview {
  margin-top: 8px;
  max-height: 120px;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid #e5e7eb;
  background: #f9fafb;
  display: flex;
  align-items: center;
  justify-content: center;
}
.cover-preview img {
  max-width: 100%;
  max-height: 120px;
  object-fit: cover;
  display: block;
}
.cover-preview-error {
  padding: 12px;
  font-size: 12px;
  color: #9ca3af;
}

/* ---------- 按钮 ---------- */
.btn {
  padding: 9px 22px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  transition: background 0.2s, opacity 0.2s, transform 0.1s;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  line-height: 1;
}

.btn:active {
  transform: scale(0.97);
}

.btn--primary {
  background: #3b82f6;
  color: white;
}
.btn--primary:hover:not(:disabled) {
  background: #2563eb;
}
.btn--primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn--ghost {
  background: transparent;
  color: #6b7280;
  border: 1.5px solid #e5e7eb;
}
.btn--ghost:hover {
  background: #f3f4f6;
  border-color: #d1d5db;
}

/* 加载 spinner */
.btn-spinner {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255,255,255,0.4);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
