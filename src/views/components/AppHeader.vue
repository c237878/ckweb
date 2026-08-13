<template>
  <header class="app-header">
    <div class="header-content">
      <div class="logo">
        <router-link to="/">{{ siteName }}</router-link>
      </div>
      <nav class="nav-menu">
        <router-link to="/" class="nav-item">首页</router-link>
        <router-link to="/videos" class="nav-item">影片</router-link>
        <router-link to="/series" class="nav-item">系列</router-link>
        <router-link to="/actors" class="nav-item">演员</router-link>
        <router-link to="/comics" class="nav-item">漫画</router-link>
        <router-link to="/highlights" class="nav-item">精彩瞬间</router-link>
        <router-link to="/settings" class="nav-item">设置</router-link>
      </nav>
    </div>
  </header>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { settingApi } from '@/scripts/api'

const siteName = ref('影视网站')

const loadSiteName = async () => {
  try {
    const res = await settingApi.getByName('siteName')
    if (res.success && res.data) {
      siteName.value = res.data
    }
  } catch (error) {
    console.error('加载网站名称失败:', error)
  }
}

const handleSettingsUpdate = () => {
  // 任意设置保存后都重新拉取网站名称
  loadSiteName()
}

onMounted(() => {
  loadSiteName()
  window.addEventListener('settingsUpdated', handleSettingsUpdate)
})

onUnmounted(() => {
  window.removeEventListener('settingsUpdated', handleSettingsUpdate)
})
</script>

<style scoped>
.app-header {
  background: #2c3e50;
  color: white;
  padding: 15px 0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.header-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.logo a {
  font-size: 24px;
  font-weight: bold;
  color: white;
  text-decoration: none;
}

.nav-menu {
  display: flex;
  gap: 30px;
}

.nav-item {
  color: white;
  text-decoration: none;
  transition: color 0.3s;
  font-size: 16px;
}

.nav-item:hover,
.nav-item.router-link-active {
  color: #e74c3c;
}

@media (max-width: 768px) {
  .header-content {
    flex-direction: column;
    gap: 15px;
  }

  .nav-menu {
    flex-wrap: wrap;
    justify-content: center;
    gap: 15px;
  }
}
</style>
