<script setup>
import { onMounted } from 'vue'
import AppHeader from '@/views/components/AppHeader.vue'
import AppFooter from '@/views/components/AppFooter.vue'
import LikeCalendar from '@/views/components/LikeCalendar.vue'
import AppOverlays from '@/views/components/AppOverlays.vue'
import { useAppStore } from '@/scripts/store/app'
import { setupInputBehavior } from '@/scripts/utils/inputBehavior'

const app = useAppStore()

onMounted(() => {
  // 站点名/分页大小等只在这里拉一次，Header/Footer 直接读 store
  app.init()
  setupInputBehavior()
})
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
  <!-- 悬浮日历：窄屏收成右下角小圆钮，避免盖住内容 -->
  <div class="floating-calendar">
    <LikeCalendar />
  </div>
  <AppOverlays />
</template>

<style scoped>
#app {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

#main-container {
  flex: 1;
  width: 100%;
  max-width: var(--container);
  margin: 0 auto;
}

.floating-calendar {
  position: fixed;
  right: var(--s5);
  bottom: var(--s5);
  z-index: var(--z-fab);
}

@media (max-width: 900px) {
  .floating-calendar {
    right: var(--s3);
    bottom: var(--s3);
  }
}
</style>
