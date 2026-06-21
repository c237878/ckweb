import { createRouter, createWebHistory } from 'vue-router'
import Home from '@/views/pages/Home.vue'
import VideoList from '@/views/pages/VideoList.vue'
import VideoDetail from '@/views/pages/VideoDetail.vue'
import ActorList from '@/views/pages/ActorList.vue'
import ActorDetail from '@/views/pages/ActorDetail.vue'
import SeriesList from '@/views/pages/SeriesList.vue'
import Settings from '@/views/pages/Settings.vue'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: Home
  },
  {
    path: '/videos',
    name: 'VideoList',
    component: VideoList
  },
  {
    path: '/video/:id',
    name: 'VideoDetail',
    component: VideoDetail
  },
  {
    path: '/actors',
    name: 'ActorList',
    component: ActorList
  },
  {
    path: '/actor/:id',
    name: 'ActorDetail',
    component: ActorDetail
  },
  {
    path: '/series',
    name: 'SeriesList',
    component: SeriesList
  },
  {
    path: '/settings',
    name: 'Settings',
    component: Settings
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
