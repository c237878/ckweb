<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { settingApi } from '@/scripts/api'
import AppHeader from '@/views/components/AppHeader.vue'
import AppFooter from '@/views/components/AppFooter.vue'
import LikeCalendar from '@/views/components/LikeCalendar.vue'

const siteName = ref('影视网站')

onMounted(async () => {
  await loadSiteName()
  window.addEventListener('settingsUpdated', handleSettingsUpdate)
})

onUnmounted(() => {
  window.removeEventListener('settingsUpdated', handleSettingsUpdate)
})

const loadSiteName = async () => {
  try {
    const res = await settingApi.getByName('siteName')
    if (res.success && res.data) {
      siteName.value = res.data
      document.title = res.data
    }
  } catch (error) {
    console.error('加载网站名称失败:', error)
  }
}

const handleSettingsUpdate = (event) => {
  if (event.detail && event.detail.siteName) {
    siteName.value = event.detail.siteName
    document.title = event.detail.siteName
  }
}
</script>

<template>
  <div id="app">
    <header id="header">
      <AppHeader />
    </header>
    <main id="main-container">
      <router-view />
    </main>
    <footer id="footer">
      <AppFooter />
    </footer>
  </div>
  <!-- 悬浮日历 -->
  <div class="floating-calendar">
    <LikeCalendar />
  </div>
</template>

<style scoped>
#app {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

#header {
  flex-shrink: 0;
}

#main-container {
  flex: 1;
  padding: 20px;
  max-width: 1200px;
  width: 100%;
  margin: 0 auto;
}

#footer {
  flex-shrink: 0;
  margin-top: auto;
}

.floating-calendar {
  position: fixed;
  right: 20px;
  bottom: 20px;
  z-index: 100;
}
</style>
