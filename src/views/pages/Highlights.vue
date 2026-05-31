<template>
  <div class="highlights">
    <h1>精彩集锦</h1>
    <div class="highlights-grid">
      <div class="highlight-card" v-for="highlight in highlights" :key="highlight.id">
        <div class="highlight-image">
          <img v-if="highlight.image" :src="highlight.image" :alt="highlight.title" />
          <div v-else class="no-image">暂无图片</div>
        </div>
        <div class="highlight-info">
          <h3>{{ highlight.title || '精彩瞬间' }}</h3>
          <p v-if="highlight.description">{{ highlight.description }}</p>
        </div>
      </div>
    </div>
    <div class="pagination" v-if="total > pageSize">
      <button :disabled="page === 1" @click="changePage(page - 1)">上一页</button>
      <span>第 {{ page }} 页</span>
      <button :disabled="page * pageSize >= total" @click="changePage(page + 1)">下一页</button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { highlightApi } from '@/scripts/api'

const highlights = ref([])
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)

onMounted(() => {
  loadHighlights()
})

const loadHighlights = async () => {
  try {
    const res = await highlightApi.getList({
      page: page.value,
      pageSize: pageSize.value
    })
    if (res.success) {
      highlights.value = res.data
      total.value = res.total
    }
  } catch (error) {
    console.error('加载精彩集锦失败:', error)
  }
}

const changePage = (newPage) => {
  page.value = newPage
  loadHighlights()
}
</script>

<style scoped>
.highlights {
  padding: 20px 0;
}

h1 {
  margin-bottom: 30px;
}

.highlights-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
}

.highlight-card {
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  background: #fff;
}

.highlight-image {
  width: 100%;
  height: 300px;
  background: #f0f0f0;
}

.highlight-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.no-image {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #999;
}

.highlight-info {
  padding: 15px;
}

.highlight-info h3 {
  margin-bottom: 8px;
}

.highlight-info p {
  color: #666;
  font-size: 14px;
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 20px;
}

.pagination button {
  padding: 8px 16px;
  background: #e74c3c;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.pagination button:disabled {
  background: #ccc;
  cursor: not-allowed;
}
</style>
