<template>
  <header class="app-header" :class="{ 'nav-open': navOpen }">
    <div class="header-content">
      <div class="logo">
        <router-link to="/">{{ app.siteName }}</router-link>
      </div>

      <nav class="nav-menu" aria-label="主导航">
        <router-link
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="nav-item"
          :active-class="item.exact ? '' : 'is-active'"
          exact-active-class="is-active"
        >
{{ item.label }}
</router-link>
      </nav>

      <div class="header-tools">
        <button
          class="theme-toggle"
          type="button"
          :title="app.themeLabel"
          :aria-label="app.themeLabel"
          @click="app.toggleTheme()"
        >
          <span aria-hidden="true">{{ app.theme === 'dark' ? '☾' : '☀' }}</span>
        </button>
        <button
          class="nav-trigger"
          type="button"
          :aria-expanded="navOpen ? 'true' : 'false'"
          aria-label="展开导航"
          @click="navOpen = !navOpen"
        >
          <span aria-hidden="true">☰</span>
        </button>
      </div>
    </div>
  </header>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useAppStore } from '@/scripts/store/app'

const app = useAppStore()
const route = useRoute()
const navOpen = ref(false)

// 窄屏菜单是覆盖在内容上的，跳完页不收起就会挡住新页面顶部
watch(() => route.path, () => { navOpen.value = false })

const navItems = [
  { to: '/', label: '首页', exact: true },
  { to: '/videos', label: '影片' },
  { to: '/series', label: '系列' },
  { to: '/actors', label: '演员' },
  { to: '/comics', label: '漫画' },
  { to: '/likes', label: '点赞' },
  { to: '/highlights', label: '精彩瞬间' },
  { to: '/settings', label: '设置' }
]
</script>

<style scoped>
.app-header {
  position: sticky;
  top: 0;
  z-index: var(--z-header);
  background: var(--bg-elev);
  border-bottom: 1px solid var(--border);
}

.header-content {
  max-width: var(--container);
  margin: 0 auto;
  padding: 0 var(--s5);
  display: flex;
  align-items: center;
  gap: var(--s5);
  min-height: var(--header-h);
}

.logo a {
  font-size: var(--f-xl);
  font-weight: 750;
  letter-spacing: .3px;
  color: var(--text);
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  gap: var(--s2);
}

.logo a::before {
  content: '◐';
  color: var(--accent);
}

.nav-menu {
  display: flex;
  align-items: center;
  gap: var(--s1);
  flex: 1;
  overflow-x: auto;
  scrollbar-width: none;
}

.nav-menu::-webkit-scrollbar {
  display: none;
}

.nav-item {
  padding: 7px 12px;
  border-radius: var(--r1);
  font-size: var(--f-md);
  color: var(--text-dim);
  white-space: nowrap;
  transition: color var(--dur) var(--ease), background var(--dur) var(--ease);
}

.nav-item:hover {
  color: var(--text);
  background: var(--bg-hover);
}

.nav-item.is-active {
  color: var(--accent);
  background: var(--accent-soft);
  font-weight: 600;
}

.header-tools {
  display: flex;
  align-items: center;
  gap: var(--s1);
  margin-left: auto;
}

.theme-toggle,
.nav-trigger {
  display: grid;
  place-items: center;
  width: var(--ctl-h-sm);
  height: var(--ctl-h-sm);
  border-radius: var(--r1);
  color: var(--text-dim);
  font-size: var(--f-lg);
}

.theme-toggle:hover,
.nav-trigger:hover {
  background: var(--bg-hover);
  color: var(--text);
}

.nav-trigger {
  display: none;
}

@media (max-width: 900px) {
  .header-content {
    padding: 0 var(--s4);
    gap: var(--s3);
  }

  .nav-trigger {
    display: grid;
  }

  /* 窄屏收成下拉，避免 8 个链接折成三行把内容挤到首屏外 */
  .nav-menu {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    display: none;
    flex-direction: column;
    align-items: stretch;
    gap: 2px;
    padding: var(--s2) var(--s3) var(--s3);
    background: var(--bg-elev);
    border-bottom: 1px solid var(--border);
    box-shadow: var(--shadow-2);
    overflow: visible;
  }

  .app-header.nav-open .nav-menu {
    display: flex;
  }

  .nav-item {
    padding: 10px 12px;
  }
}
</style>
