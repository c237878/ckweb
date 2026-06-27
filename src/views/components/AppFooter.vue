<template>
  <footer class="app-footer">
    <div class="footer-content">
      <!-- 友情链接 -->
      <div class="friend-links" v-if="friendLinks.length > 0">
        <span class="links-title">友情链接：</span>
        <a
          v-for="link in friendLinks"
          :key="link.id"
          :href="link.link"
          target="_blank"
          :title="link.description || link.name"
          class="friend-link"
        >
          <img v-if="link.logo" :src="link.logo" :alt="link.name" class="link-logo" />
          <span v-else>{{ link.name }}</span>
        </a>
      </div>
      <div class="copyright">
        <p>&copy; {{ currentYear }} {{ siteName }} All Rights Reserved</p>
      </div>
    </div>
  </footer>
</template>

<script setup>
import { ref, onMounted, computed, onUnmounted } from 'vue'
import { settingApi, friendLinkApi } from '@/scripts/api'

const siteName = ref('影视网站')
const friendLinks = ref([])
const currentYear = computed(() => new Date().getFullYear())

const loadFooterData = async () => {
  // 加载网站名称
  try {
    const res = await settingApi.getByName('siteName')
    if (res.success && res.data) {
      siteName.value = res.data
    }
  } catch (error) {
    console.error('加载网站名称失败:', error)
  }
  // 加载好友链接
  await loadFriendLinks()
}

const loadFriendLinks = async () => {
  try {
    const res = await friendLinkApi.getList()
    if (res.success) {
      friendLinks.value = res.data || []
    }
  } catch (error) {
    console.error('加载链接失败:', error)
  }
}

// 监听设置更新
const handleSettingsUpdate = () => {
  loadFooterData()
}

// 监听链接更新
const handleFriendLinksUpdate = () => {
  loadFriendLinks()
}

onMounted(async () => {
  await loadFooterData()
  window.addEventListener('settingsUpdated', handleSettingsUpdate)
  window.addEventListener('friendLinksUpdated', handleFriendLinksUpdate)
})

onUnmounted(() => {
  window.removeEventListener('settingsUpdated', handleSettingsUpdate)
  window.removeEventListener('friendLinksUpdated', handleFriendLinksUpdate)
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
  text-align: center;
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 8px;
}

.links-title {
  color: #999;
  font-size: 14px;
}

.friend-link {
  color: #fff;
  text-decoration: none;
  font-size: 14px;
  padding: 4px 12px;
  border: 1px solid rgba(255,255,255,0.3);
  border-radius: 4px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: all 0.2s;
}

.friend-link:hover {
  background: rgba(255,255,255,0.1);
  border-color: rgba(255,255,255,0.5);
}

.link-logo {
  max-width: 80px;
  max-height: 20px;
}

.copyright {
  text-align: center;
  color: #999;
  font-size: 14px;
}
</style>
