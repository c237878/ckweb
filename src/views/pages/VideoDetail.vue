<template>
    <div class="video-detail" v-if="video">
        <div class="layout">
            <!-- 左侧：播放区 + 信息区 -->
            <div class="left-panel">
                <div class="player-section">
                    <div class="player-wrapper" :style="playerRotation">
                        <video
                            v-if="video.videoUrl"
                            ref="videoPlayer"
                            :src="video.videoUrl"
                            controls
                            @timeupdate="onTimeUpdate"
                        ></video>
                        <div v-else class="no-video">暂无视频</div>
                    </div>
                </div>
                <div class="info-section">
                    <div class="info-row1">{{ video.code }} {{ video.name }}</div>
                    <div class="info-row2">
                        <span v-if="video.country">{{ video.country }}</span>
                        <span v-if="video.quality">{{ video.quality }}</span>
                        <span v-if="video.videoSize">{{ formatSize(video.videoSize) }}</span>
                    </div>
                    <div class="info-row3" v-if="series">
                        <span>所属系列：</span>
                        <a class="series-link" @click="goToSeries(series.id)">{{ series.name }}</a>
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

            <!-- 右侧：操作区 + 推荐区 -->
            <div class="right-panel">
                <div class="action-section">
                    <button class="action-btn" @click="captureScreenshot">
                        <span class="btn-icon">📸</span>
                        <span>截图</span>
                    </button>
                    <button class="action-btn" @click="toggleRotation">
                        <span class="btn-icon">🔄</span>
                        <span>{{ isRotated ? '复原' : '旋转' }}</span>
                    </button>
                    <button class="action-btn" :class="{ active: isLiked }" @click="toggleLike">
                        <span class="btn-icon">{{ isLiked ? '❤️' : '🤍' }}</span>
                        <span>{{ isLiked ? '已赞' : '点赞' }}</span>
                        <span class="like-count" v-if="likeCount > 0">({{ likeCount }})</span>
                    </button>
                    <button class="action-btn" @click="goToEdit">
                        <span class="btn-icon">✏️</span>
                        <span>编辑</span>
                    </button>
                </div>
                <div class="recommend-section" v-if="recommendList.length > 0">
                    <div class="recommend-title">推荐视频</div>
                    <div class="recommend-grid">
                        <div
                            v-for="item in recommendList"
                            :key="item.id"
                            class="recommend-card"
                            @click="goToVideo(item.id)"
                        >
                            <div class="recommend-cover">
                                <img v-if="item.coverUrl" :src="item.coverUrl" :alt="item.name" />
                                <div v-else class="no-cover">暂无封面</div>
                            </div>
                            <div class="recommend-info">
                                <div class="recommend-name">{{ item.name }}</div>
                                <div class="recommend-code">{{ item.code }}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { videoApi, likeApi } from '@/scripts/api'

const route = useRoute()
const router = useRouter()
const video = ref(null)
const actors = ref([])
const series = ref(null)
const recommendList = ref([])
const likeCount = ref(0)
const isLiked = ref(false)
const isRotated = ref(false)
const videoPlayer = ref(null)
const userToken = ref(localStorage.getItem('userToken') || generateToken())

const playerRotation = computed(() => ({
    transform: isRotated.value ? 'rotate(90deg)' : 'none'
}))

onMounted(async () => {
    await loadVideo()
    await loadLikeInfo()
    await loadRecommend()
})

const loadVideo = async () => {
    try {
        const res = await videoApi.getDetail(route.params.id)
        if (res.success) {
            video.value = res.data
            actors.value = res.actors || []
            series.value = res.series || null
        }
    } catch (error) {
        console.error('加载视频详情失败:', error)
    }
}

const loadLikeInfo = async () => {
    try {
        const [countRes, likedRes] = await Promise.all([
            likeApi.getCount(route.params.id),
            likeApi.checkLiked(route.params.id, userToken.value)
        ])
        if (countRes.success) likeCount.value = countRes.data
        if (likedRes.success) isLiked.value = likedRes.data
    } catch (error) {
        console.error('加载点赞信息失败:', error)
    }
}

const loadRecommend = async () => {
    try {
        const res = await videoApi.getRecommend(route.params.id, 8)
        if (res.success) {
            recommendList.value = res.data || []
        }
    } catch (error) {
        console.error('加载推荐视频失败:', error)
    }
}

const toggleLike = async () => {
    try {
        if (isLiked.value) {
            const res = await likeApi.unlike(route.params.id, userToken.value)
            if (res.success) {
                isLiked.value = false
                likeCount.value--
            }
        } else {
            const res = await likeApi.like(route.params.id, userToken.value)
            if (res.success) {
                isLiked.value = true
                likeCount.value++
                localStorage.setItem('userToken', userToken.value)
            }
        }
    } catch (error) {
        console.error('点赞操作失败:', error)
    }
}

const captureScreenshot = () => {
    if (!videoPlayer.value) return
    const video = videoPlayer.value
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    const link = document.createElement('a')
    link.download = `${video.value.code || 'screenshot'}_${Date.now()}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
}

const toggleRotation = () => {
    isRotated.value = !isRotated.value
}

const goToEdit = () => {
    router.push(`/video/${route.params.id}/edit`)
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

const onTimeUpdate = () => {}

const formatSize = (bytes) => {
    if (!bytes) return '未知'
    const units = ['B', 'KB', 'MB', 'GB', 'TB']
    let i = 0
    while (bytes >= 1024 && i < units.length - 1) {
        bytes /= 1024
        i++
    }
    return bytes.toFixed(2) + ' ' + units[i]
}

function generateToken() {
    return 'user_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36)
}
</script>

<style scoped>
.video-detail {
    padding: 20px;
    max-width: 1400px;
    margin: 0 auto;
}

.layout {
    display: flex;
    gap: 24px;
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
    overflow: hidden;
}

.player-wrapper {
    width: 100%;
}

.player-wrapper video {
    width: 100%;
    display: block;
}

.no-video {
    height: 400px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #999;
    font-size: 18px;
}

.info-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 4px 0;
}

.info-row1 {
    font-size: 18px;
    font-weight: bold;
    color: #333;
}

.info-row2 {
    font-size: 14px;
    color: #666;
    display: flex;
    gap: 12px;
}

.info-row3,
.info-row4 {
    font-size: 14px;
    color: #666;
}

.series-link,
.actor-link {
    color: #3498db;
    cursor: pointer;
    text-decoration: none;
}

.series-link:hover,
.actor-link:hover {
    text-decoration: underline;
}

.actor-link:not(:last-child)::after {
    content: '、';
    color: #666;
}

.right-panel {
    width: 360px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 24px;
}

.action-section {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
}

.action-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 10px 16px;
    border: 1px solid #ddd;
    border-radius: 8px;
    background: #fff;
    cursor: pointer;
    font-size: 14px;
    color: #333;
    transition: all 0.2s;
}

.action-btn:hover {
    border-color: #3498db;
    color: #3498db;
    background: #f0f8ff;
}

.action-btn.active {
    border-color: #e74c3c;
    color: #e74c3c;
    background: #fef0f0;
}

.btn-icon {
    font-size: 16px;
}

.like-count {
    font-size: 12px;
    color: #999;
}

.recommend-title {
    font-size: 16px;
    font-weight: bold;
    color: #333;
    margin-bottom: 16px;
}

.recommend-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
}

.recommend-card {
    cursor: pointer;
    border-radius: 8px;
    overflow: hidden;
    background: #fff;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    transition: transform 0.2s;
}

.recommend-card:hover {
    transform: translateY(-3px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.recommend-cover {
    width: 100%;
    padding-top: 67.25%;
    position: relative;
    background: #f0f0f0;
    overflow: hidden;
}

.recommend-cover img {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.no-cover {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #999;
    font-size: 12px;
}

.recommend-info {
    padding: 8px;
}

.recommend-name {
    font-size: 13px;
    color: #333;
    font-weight: bold;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.recommend-code {
    font-size: 12px;
    color: #999;
    margin-top: 2px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

/* 响应式：小屏幕时上下布局 */
@media (max-width: 900px) {
    .layout {
        flex-direction: column;
    }
    .right-panel {
        width: 100%;
    }
}
</style>
