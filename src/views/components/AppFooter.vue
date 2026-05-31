<template>
  <footer class="app-footer">
    <div class="footer-content">
      <div class="friend-links" v-if="friendLinks.length">
        <h4>友情链接</h4>
        <div class="links">
          <a v-for="link in friendLinks" :key="link.id" :href="link.link" target="_blank">
            {{ link.name }}
          </a>
        </div>
      </div>
      <div class="copyright">
        <p>&copy; {{ currentYear }} 影视网站 All Rights Reserved</p>
      </div>
    </div>
  </footer>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { friendLinkApi } from '@/scripts/api'

const friendLinks = ref([])

const currentYear = computed(() => new Date().getFullYear())

onMounted(async () => {
  try {
    const res = await friendLinkApi.getList()
    if (res.success) {
      friendLinks.value = res.data
    }
  } catch (error) {
    console.error('加载友情链接失败:', error)
  }
})
</script>

<style scoped>
.app-footer {
  background: #2c3e50;
  color: white;
  padding: 30px 0;
  margin-top: 50px;
}

.footer-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px;
}

.friend-links {
  margin-bottom: 20px;
}

.friend-links h4 {
  margin-bottom: 10px;
}

.links {
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
}

.links a {
  color: #bbb;
  text-decoration: none;
  transition: color 0.3s;
}

.links a:hover {
  color: #e74c3c;
}

.copyright {
  text-align: center;
  color: #999;
  font-size: 14px;
}
</style>
