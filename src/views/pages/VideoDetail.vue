<template>
    <div class="video-detail" v-if="video">
        <div class="layout">
            <!-- 左侧：播放区 + 信息区 -->
            <div class="left-panel">
                <div class="player-section">
                    <div class="player-wrapper" :style="wrapperStyle">
                        <div v-if="video.id" id="ckplayer" ref="playerContainer"></div>
                        <div v-else class="no-video">暂无视频</div>
                        <!-- 音量提示 -->
                        <div v-if="volumeTipVisible" class="volume-tip">
                            <span>音量: {{ Math.round(currentVolume * 100) }}%</span>
                        </div>
                    </div>
                </div>
                <div class="info-section">
                    <div class="info-row1">
                        <span>{{ video.code ? video.code + ' ' + video.name : video.name }}</span>
                    </div>
                    <div class="info-row2">
                        <span v-if="video.country" class="country-tag">{{ video.country }}</span>
                        <span v-if="video.category" class="type-tag">{{ video.category }}</span>
                        <span v-if="likeCount > 0" class="like-count">♥ {{ likeCount }}</span>
                        <span v-if="video.fileSize" class="file-size">{{ formatSize(video.fileSize) }}</span>
                    </div>
                    <div class="info-row3" v-if="video.seriesName">
                        <span>系列：</span>
                        <a :key="video.seriesId" class="actor-link" @click="goToSeries(video.seriesId)">{{ video.seriesName }}</a>
                    </div>
                    <div class="info-row4" v-if="actors.length > 0">
                        <span>参演演员：</span>
                        <a
                            v-for="actor in actors"
                            :key="actor.id"
                            class="actor-link"
                            @click="goToActor(actor.id)"
                        >{{ actor.name }}</a>
                    </div>
                </div>
            </div>

            <!-- 右侧：操作区 + 推荐区，支持折叠 -->
            <div class="right-panel" :class="{ collapsed: panelCollapsed }">
                <div class="panel-toggle" @click="panelCollapsed = !panelCollapsed">
                    {{ panelCollapsed ? '◀' : '▶' }}
                </div>
                <template v-if="!panelCollapsed">
                    <div class="action-section">
                        <button class="action-btn like-btn" @click="handleLike">
                            <span>点赞</span>
                        </button>
                        <button class="action-btn" @click="handleScreenshot">
                            <span>截图</span>
                        </button>
                        <button class="action-btn" @click="rotateVideo">
                            <span>旋转</span>
                        </button>
                        <button class="action-btn" @click="openEditDialog">
                            <span>编辑</span>
                        </button>
                        <button class="action-btn" @click="resetFileSize" :disabled="resetting">
                            <span>重置</span>
                        </button>
                    </div>
                    <div class="recommend-section" v-if="recommendList.length > 0">
                        <div class="recommend-title">推荐视频</div>
                        <div class="recommend-grid">
                            <VideoCard
                                v-for="item in recommendList"
                                :key="item.id"
                                :video="item"
                                mode="brief"
                                @click="goToVideo(item.id)"
                            />
                        </div>
                    </div>
                </template>
            </div>
        </div>

        <!-- 编辑弹窗 -->
        <AddVideoDialog
            :visible="showEditDialog"
            :editingVideo="editingVideo"
            @save="onEditSave"
            @cancel="showEditDialog = false; editingVideo = null"
            @delete="onDeleteVideo"
        />
    </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { videoApi } from '@/scripts/api'
import AddVideoDialog from '@/views/components/AddVideoDialog.vue'
import VideoCard from '@/views/components/VideoCard.vue'
import { formatSize } from '@/scripts/utils/format'

const route = useRoute()
const router = useRouter()
const video = ref(null)
const actors = ref([])
const recommendList = ref([])
const rotation = ref(0)
const currentVolume = ref(1)  // 默认音量 1 (100%)
const STORAGE_KEY = 'ckplayer_volume'

// 从本地存储加载音量
const loadVolume = () => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved !== null) {
        currentVolume.value = parseFloat(saved)
    }
}

// 保存音量到本地存储
const saveVolume = () => {
    localStorage.setItem(STORAGE_KEY, currentVolume.value.toString())
}

// 设置播放器音量
const setVolume = (vol) => {
    currentVolume.value = Math.max(0, Math.min(1, vol))
    saveVolume()
    
    if (ckplayerInstance) {
        try {
            ckplayerInstance.volume(currentVolume.value)
        } catch (e) {
            console.warn('设置音量失败:', e)
        }
    }
}

// 键盘控制音量
const handleKeyDown = (e) => {
    // 只有在页面可见且没有焦点在输入框时才响应
    if (document.visibilityState === 'hidden') return
    const activeTag = document.activeElement?.tagName?.toLowerCase()
    if (activeTag === 'input' || activeTag === 'textarea') return
    
    if (e.key === 'ArrowUp') {
        e.preventDefault()
        setVolume(currentVolume.value + 0.1)
        showVolumeTip()
    } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setVolume(currentVolume.value - 0.1)
        showVolumeTip()
    }
}
const showEditDialog = ref(false)
const editingVideo = ref(null)
const panelCollapsed = ref(false)
const likeCount = ref(0)
const resetting = ref(false)
const volumeTipVisible = ref(false)
let volumeTipTimer = null

const videoNaturalWidth = ref(0)
const videoNaturalHeight = ref(0)
const playerContainer = ref(null)
let ckplayerInstance = null

const wrapperStyle = computed(() => {
    if (!videoNaturalWidth.value || !videoNaturalHeight.value) {
        return { aspectRatio: '16/9' }
    }
    const ar = videoNaturalWidth.value / videoNaturalHeight.value
    if (rotation.value % 180 === 90) {
        return { aspectRatio: (1 / ar).toFixed(4) }
    }
    return { aspectRatio: ar.toFixed(4) }
})

const initCkplayer = () => {
    if (!video.value?.id) return

    // 销毁旧实例
    if (ckplayerInstance) {
        try {
            ckplayerInstance.remove()
        } catch (e) {
            console.warn('销毁播放器失败:', e)
        }
        ckplayerInstance = null
    }

    const videoUrl = `/api/video/stream/${video.value.id}`
    
    // 封面图片：优先使用后端代理接口
    const poster = video.value.coverPath 
        ? `/api/video/cover/${video.value.id}` 
        : ''
    
    const videoObject = {
        container: '#ckplayer',
        variable: 'player',
        autoplay: false,
        video: videoUrl,
        screenshot: true,  // 开启截图功能
        poster: poster  // 封面图片
    }

    // ckplayer 通过 UMD 挂载到 window.ckplayer
    if (typeof window.ckplayer === 'undefined') {
        console.error('ckplayer 未加载')
        return
    }

    ckplayerInstance = new window.ckplayer(videoObject)
    
    // 恢复保存的音量
    if (currentVolume.value !== 1) {
        setTimeout(() => {
            setVolume(currentVolume.value)
        }, 500)
    }
    
    // 获取视频元数据
    setTimeout(() => {
        if (ckplayerInstance) {
            try {
                const metaData = ckplayerInstance.getMetaDate()
                if (metaData) {
                    videoNaturalWidth.value = metaData.width || 1920
                    videoNaturalHeight.value = metaData.height || 1080
                }
            } catch (e) {
                console.warn('获取视频元数据失败:', e)
            }
        }
    }, 1000)
}

// 显示音量提示
const showVolumeTip = () => {
    // 通过设置一个临时值来触发提示显示
    volumeTipVisible.value = true
    clearTimeout(volumeTipTimer)
    volumeTipTimer = setTimeout(() => {
        volumeTipVisible.value = false
    }, 1000)
}

onMounted(async () => {
    loadVolume()
    document.addEventListener('keydown', handleKeyDown)
    await loadVideo()
    await loadRecommend()
})

onUnmounted(() => {
    document.removeEventListener('keydown', handleKeyDown)
    clearTimeout(volumeTipTimer)
    if (ckplayerInstance) {
        try {
            ckplayerInstance.remove()
        } catch (e) {
            console.warn('销毁播放器失败:', e)
        }
        ckplayerInstance = null
    }
})

watch(() => route.params.id, async (newId, oldId) => {
    if (newId && newId !== oldId) {
        rotation.value = 0
        await loadVideo()
        await loadRecommend()
        window.scrollTo(0, 0)
    }
})

const loadVideo = async () => {
    try {
        const res = await videoApi.getDetail(route.params.id)
        if (res.success) {
            video.value = res.data.video || res.data
            actors.value = res.data.actors || []
            likeCount.value = res.data.likeCount || 0

            // 初始化 ckplayer
            nextTick(() => {
                initCkplayer()
            })
        }
    } catch (error) {
        console.error('加载视频详情失败:', error)
    }
}

const loadRecommend = async () => {
    try {
        if (!video.value?.id) return
        const res = await videoApi.getRecommend(video.value.id, 8)
        if (res.success) {
            recommendList.value = res.data || []
        }
    } catch (error) {
        console.error('加载推荐视频失败:', error)
    }
}

// 截图功能
const handleScreenshot = () => {
    if (!ckplayerInstance) {
        console.warn('播放器未初始化')
        return
    }
    
    try {
        // ckplayer 的 screenshot 方法会触发 screenshot 事件并返回 base64
        const base64 = ckplayerInstance.screenshot()
        if (base64) {
            // 在新标签页打开截图
            const imgWindow = window.open('', '_blank')
            if (imgWindow) {
                imgWindow.document.write(`
                    <html>
                    <head><title>截图 - ${video.value?.name || '视频'}</title></head>
                    <body style="margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#000;">
                        <img src="${base64}" style="max-width:100%;max-height:100%;" />
                    </body>
                    </html>
                `)
                imgWindow.document.close()
            }
        }
    } catch (e) {
        console.error('截图失败:', e)
    }
}

const rotateVideo = () => {
    rotation.value = (rotation.value + 90) % 360
    // 直接旋转 video 元素
    const videoEl = document.querySelector('#ckplayer video')
    if (videoEl) {
        videoEl.style.transform = `rotate(${rotation.value}deg)`
        videoEl.style.transformOrigin = 'center center'
        console.log('视频旋转:', rotation.value)
    } else {
        console.warn('video 元素未找到')
    }
}

const openEditDialog = () => {
    editingVideo.value = { ...video.value }
    showEditDialog.value = true
}

const resetFileSize = async () => {
    if (!video.value?.id) return
    resetting.value = true
    try {
        const res = await videoApi.resetFileSize(video.value.id)
        if (res.success) {
            video.value.file_size = res.data.fileSize
            video.value.file_size = res.data.fileSize
            video.value.fileSize = res.data.fileSize
            console.log('重置成功！文件大小:', formatSize(res.data.fileSize))
        } else {
            alert('重置失败: ' + (res.message || '未知错误'))
        }
    } catch (error) {
        console.error('重置失败:', error)
        alert('重置失败: ' + error.message)
    }
    resetting.value = false
}

const onEditSave = async (formData) => {
    try {
        await videoApi.update(video.value.id, formData)
        showEditDialog.value = false
        editingVideo.value = null
        await loadVideo()
    } catch (error) {
        console.error('保存失败:', error)
    }
}

const onDeleteVideo = async (videoId) => {
    try {
        await videoApi.delete(videoId)
        router.push('/')
    } catch (error) {
        console.error('删除失败:', error)
    }
}

const goToSeries = (id) => {
    router.push(`/series/${id}`)
}

const goToActor = (id) => {
    router.push(`/actor/${id}`)
}

const goToVideo = (id) => {
    router.push(`/video/${id}`)
    window.scrollTo(0, 0)
}

const handleLike = async () => {
    try {
        const res = await videoApi.like(video.value.id)
        if (res.success) {
            likeCount.value = res.likeCount
        }
    } catch (error) {
        console.error('点赞失败:', error)
    }
}

// formatSize 已迁移至 @/scripts/utils/format.js
</script>

<style scoped>
.video-detail {
    padding: 20px;
    max-width: 1400px;
    margin: 0 auto;
}

.layout {
    display: flex;
    gap: 16px;
    align-items: flex-start;
}

.left-panel {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.player-section {
    width: 100%;
    background: #000;
    border-radius: 8px;
    overflow: visible;
}

.player-wrapper {
    width: 100%;
    position: relative;
    background: #000;
}

.player-wrapper video {
    width: 100%;
    height: 100%;
    display: block;
    object-fit: contain;
}

.player-wrapper #ckplayer {
    width: 100%;
    height: 100%;
}

.no-video {
    aspect-ratio: 16/9;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #999;
    font-size: 18px;
}

.volume-tip {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(0, 0, 0, 0.75);
    color: #fff;
    padding: 12px 24px;
    border-radius: 8px;
    font-size: 16px;
    pointer-events: none;
    z-index: 100;
}

.info-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.info-row1 {
    font-size: 18px;
    font-weight: bold;
    color: #333;
    display: flex;
    align-items: center;
    gap: 6px;
}

.info-row2 {
    font-size: 14px;
    color: #666;
    display: flex;
    gap: 12px;
    align-items: center;
}

.type-tag {
    background: #e8f4ff;
    color: #3498db;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 13px;
}

.country-tag {
    background: #fef3e8;
    color: #e67e22;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 13px;
}

.country-tag {
    background: #fff3e0;
    color: #e67e22;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 13px;
}

.info-row4 {
    font-size: 14px;
    color: #666;
}

.info-row-note {
    font-size: 13px;
    color: #999;
    line-height: 1.6;
}

.info-row3 {
    font-size: 14px;
    color: #666;
}

.info-row4 {
    display: flex;
    gap: 6px;
}

.actor-link {
    color: #3498db;
    cursor: pointer;
    text-decoration: none;
}

.actor-link:hover {
    text-decoration: underline;
}

.actor-link:not(:last-child)::after {
    color: #666;
}

.right-panel {
    width: 300px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 20px;
    position: relative;
    transition: width 0.3s, padding 0.3s, opacity 0.3s;
    overflow: hidden;
}

.right-panel.collapsed {
    width: 0;
    padding: 0;
    opacity: 0;
    gap: 0;
}

.panel-toggle {
    position: absolute;
    left: -20px;
    top: 50%;
    transform: translateY(-50%);
    width: 20px;
    height: 60px;
    background: #eee;
    border-radius: 4px 0 0 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-size: 12px;
    color: #666;
    z-index: 10;
    transition: background 0.2s;
}

.panel-toggle:hover {
    background: #ddd;
}

.action-section {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
}

.action-btn {
    width: calc(25% - 6px);
    height: 36px;
    display: flex;
    justify-content: center;
    align-items: center;
    border: 1px solid #ddd;
    border-radius: 8px;
    background: #fff;
    cursor: pointer;
    font-size: 13px;
    color: #333;
    transition: all 0.2s;
}

.action-btn:hover {
    border-color: #3498db;
    color: #3498db;
    background: #f0f8ff;
}

.action-btn.like-btn {
    border-color: #e74c3c;
    color: #e74c3c;
}

.action-btn.like-btn:hover {
    background: #fdf2f2;
}

.recommend-title {
    font-size: 15px;
    font-weight: bold;
    color: #333;
    margin-bottom: 12px;
}

.recommend-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
}

/* tag 样式 */
.country-tag, .type-tag, .series-tag, .like-count, .file-size {
  width: auto;
  height: 20px;
  line-height: 20px;
  padding: 0 6px;
  border-radius: 3px;
  font-size: 12px;
  white-space: nowrap;
}
/* 国家 tag - 紫色 */
.country-tag {
  background: #f3e5f5;
  color: #7b1fa2;
}
/* 分类 tag - 绿色 */
.type-tag {
  background: #e8f5e9;
  color: #2e7d32;
}
/* 系列 tag - 橙色 */
.series-tag {
  background: #fff3e0;
  color: #e65100;
}
/* 获赞数 */
.like-count {
  color: #e74c3c;
  background: #fce4ec;
}
/* 文件大小 */
.file-size {
  color: #555;
  background: #f0f0f0;
}

@media (max-width: 900px) {
    .layout {
        flex-direction: column;
    }
    .right-panel {
        width: 100% !important;
    }
    .right-panel.collapsed {
        width: 0 !important;
    }
}
</style>
