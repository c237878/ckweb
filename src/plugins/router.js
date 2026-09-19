import { createRouter, createWebHistory } from 'vue-router'

// 路由懒加载：每个页面单独分包，首屏只加载当前页面
const Home = () => import('@/views/pages/Home.vue')
const VideoList = () => import('@/views/pages/VideoList.vue')
const VideoDetail = () => import('@/views/pages/VideoDetail.vue')
const ActorList = () => import('@/views/pages/ActorList.vue')
const ActorDetail = () => import('@/views/pages/ActorDetail.vue')
const SeriesList = () => import('@/views/pages/SeriesList.vue')
const SeriesDetail = () => import('@/views/pages/SeriesDetail.vue')
const Settings = () => import('@/views/pages/Settings.vue')
const Highlights = () => import('@/views/pages/Highlights.vue')
const ComicList = () => import('@/views/pages/ComicList.vue')
const ComicDetail = () => import('@/views/pages/ComicDetail.vue')
const LikeList = () => import('@/views/pages/LikeList.vue')

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
    path: '/series/:id',
    name: 'SeriesDetail',
    component: SeriesDetail
  },
  {
    path: '/highlights',
    name: 'Highlights',
    component: Highlights
  },
  {
    path: '/comics',
    name: 'ComicList',
    component: ComicList
  },
  {
    path: '/comic/:id',
    name: 'ComicDetail',
    component: ComicDetail
  },
  {
    path: '/likes',
    name: 'LikeList',
    component: LikeList
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
