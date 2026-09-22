<template>
  <footer class="app-footer">
    <div class="footer-content">
      <!-- 友情链接 -->
      <nav class="friend-links" aria-label="友情链接" v-if="friendLinks.length > 0">
        <span class="links-title">友情链接：</span>
        <a
          v-for="link in friendLinks"
          :key="link.id"
          :href="link.link"
          target="_blank"
          rel="noopener noreferrer"
          :title="link.description || link.name"
          class="friend-link"
        >
          <img v-if="link.logo" :src="link.logo" :alt="link.name" class="link-logo" loading="lazy" />
          <span v-else>{{ link.name }}</span>
        </a>
      </nav>
      <div class="copyright">
        <p>&copy; {{ currentYear }} {{ app.siteName }} All Rights Reserved</p>
      </div>
    </div>
  </footer>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { friendLinkApi } from '@/scripts/api'
import { useAppStore } from '@/scripts/store/app'

const app = useAppStore()
const friendLinks = ref([])
const currentYear = computed(() => new Date().getFullYear())

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

// 网站名走 store，这里只关心页脚自己的友情链接
const handleLinksUpdate = () => loadFriendLinks()

onMounted(() => {
  loadFriendLinks()
  window.addEventListener('friendLinksUpdated', handleLinksUpdate)
})

onUnmounted(() => {
  window.removeEventListener('friendLinksUpdated', handleLinksUpdate)
})
</script>

<style scoped>
.app-footer {
  padding: var(--s5) 0;
  background: var(--bg-elev);
  border-top: 1px solid var(--border);
}

/* 与正文的间隔由 .page 自身的下内缩提供，这里不再加 margin-top */
.footer-content {
  max-width: var(--container);
  margin: 0 auto;   /* 居中容器，非间距 */
  padding: 0 var(--s5);
  display: flex;
  flex-direction: column;
  gap: var(--s4);
}

.friend-links {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: var(--s2);
}

.links-title {
  color: var(--text-faint);
  font-size: var(--f-md);
}

.friend-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: var(--ctl-h-sm);
  padding-inline: var(--ctl-pad-x-sm);
  line-height: 1;
  border: 1px solid var(--border);
  border-radius: var(--rp);
  color: var(--text-dim);
  font-size: var(--f-sm);
  transition: color var(--dur) var(--ease), border-color var(--dur) var(--ease),
    background var(--dur) var(--ease);
}

.friend-link:hover {
  color: var(--accent);
  border-color: var(--accent);
  background: var(--accent-soft);
}

.link-logo {
  max-width: 80px;
  max-height: 20px;
  object-fit: contain;
}

.copyright {
  text-align: center;
  color: var(--text-faint);
  font-size: var(--f-sm);
}
</style>
