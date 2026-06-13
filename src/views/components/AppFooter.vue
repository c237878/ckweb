<template>
  <footer class="app-footer">
    <div class="footer-content">
      <div class="copyright">
        <p>&copy; {{ currentYear }} {{ siteName }} All Rights Reserved</p>
      </div>
    </div>
  </footer>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { settingApi } from '@/scripts/api'

const siteName = ref('影视网站')
const currentYear = computed(() => new Date().getFullYear())

onMounted(async () => {
  try {
    const res = await settingApi.getByName('siteName')
    if (res.success && res.data) {
      siteName.value = res.data
    }
  } catch (error) {
    console.error('加载网站名称失败:', error)
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

.copyright {
  text-align: center;
  color: #999;
  font-size: 14px;
}
</style>
