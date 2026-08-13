<template>
  <div class="comic-card" @click="$emit('click', comic)">
    <div class="card-cover">
      <img
        v-if="comic.coverPath"
        :src="coverUrl"
        @error="imgError = true"
        alt="封面"
      />
      <div v-else class="cover-placeholder">??</div>
      <!-- 外链按钮 -->
      <a
        v-if="comic.url"
        class="external-link"
        :href="comic.url"
        target="_blank"
        rel="noopener noreferrer"
        @click.stop
        title="打开外部链接"
      >↗</a>
    </div>

    <div class="card-info">
      <div class="comic-name">{{ comic.name }}</div>
      <div class="comic-author" v-if="comic.author">{{ comic.author }}</div>
      <div class="comic-meta">
        <span class="chapter-count">{{ comic.chapterCount }} 章</span>
      </div>
    </div>

    <div class="card-actions" @click.stop>
      <slot name="actions">
        <button class="btn btn-sm btn-primary" @click="$emit('edit', comic)">编辑</button>
        <button class="btn btn-sm btn-danger" @click="$emit('delete', comic)">删除</button>
      </slot>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { comicApi } from '@/scripts/api'

const props = defineProps({
  comic: {
    type: Object,
    required: true
  }
})

defineEmits(['click', 'edit', 'delete'])

const imgError = ref(false)

const coverUrl = computed(() => {
  return comicApi.getCoverUrl(props.comic.coverPath)
})
</script>

<style scoped>
.comic-card {
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  overflow: hidden;
  cursor: pointer;
  transition: box-shadow 0.3s;
  display: flex;
  flex-direction: column;
}

.comic-card:hover {
  box-shadow: 0 4px 16px rgba(0,0,0,0.18);
}

.card-cover {
  width: 100%;
  aspect-ratio: 6/4;
  overflow: hidden;
  background: #f0f0f0;
  position: relative;
}

.card-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cover-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 48px;
  background: #e8e8e8;
}

.external-link {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 28px;
  height: 28px;
  background: rgba(0,0,0,0.5);
  color: #fff;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  text-decoration: none;
  opacity: 0;
  transition: opacity 0.2s;
  cursor: pointer;
  line-height: 1;
}

.comic-card:hover .external-link {
  opacity: 1;
}

.external-link:hover {
  background: rgba(0,0,0,0.75);
}

.card-info {
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
}

.comic-name {
  font-size: 15px;
  font-weight: bold;
  color: #333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.comic-author {
  font-size: 12px;
  color: #888;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.comic-meta {
  display: flex;
  gap: 6px;
}

.chapter-count {
  font-size: 12px;
  color: #666;
  background: #f5f5f5;
  border-radius: 3px;
}

.card-actions {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  border-top: 1px solid #f0f0f0;
}

.btn {
  border: 1px solid #ddd;
  background: #fff;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.btn-sm {
  font-size: 12px;
}

.btn-primary {
  padding: 5px 14px;
  background: #3498db;
  color: white;
  border-color: #3498db;
}

.btn-primary:hover { background: #2980b9; }

.btn-danger {
  padding: 5px 14px;
  background: #e74c3c;
  color: white;
  border-color: #e74c3c;
}

.btn-danger:hover { background: #c0392b; }
</style>
