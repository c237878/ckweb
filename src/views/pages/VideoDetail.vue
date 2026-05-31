<template>
    <div class="video-detail" v-if="video">
        <div class="layout">
            <!-- 左侧：播放区 + 信息区 -->
            <div class="left-panel">
                <div class="player-section">
                    <div class="player-wrapper" :style="wrapperStyle">
                        <video
                            v-if="video.videoUrl"
                            ref="videoPlayer"
                            :src="video.videoUrl"
                            controls
                            @loadedmetadata="onMetadata"
                            :style="videoStyle"
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

            <!-- 右侧：操作区 + 推荐区，支持折叠 -->
            <div class="right-panel" :class="{ collapsed: panelCollapsed }">
                <div class="panel-toggle" @click="panelCollapsed = !panelCollapsed">
                    {{ panelCollapsed ? '◀' : '▶' }}
                </div>
                <template v-if="!panelCollapsed">
                    <div class="action-section">
                        <button class="action-btn" @click="rotateVideo">
                            <span class="btn-icon">🔄</span>
                            <span>旋转{{ rotation ? '（' + rotation + '°）' : '' }}</span>
                        </button>
                        <button class="action-btn" @click="doLike">
                            <span class="btn-icon">❤️</span>
                            <span>点赞</span>
                            <span class="like-count" v-if="likeCount > 0">({{ likeCount }})</span>
                        </button>
                        <button class="action-btn" @click="openEditDialog">
                            <span class="btn-icon">✏️</span>
                            <span>编辑</span>
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
            @confirm="onEditConfirm"
            @cancel="showEditDialog = false; editingVideo = null"
        />
    </div>
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { videoApi, likeApi } from '@/scripts/api'
import AddVideoDialog from '@/views/components/AddVideoDialog.vue'
import VideoCard from '@/views/components/VideoCard.vue'

const route = useRoute()
const router = useRouter()
const video = ref(null)
const actors = ref([])
const series = ref(null)
const recommendList = ref([])
const likeCount = ref(0)
const rotation = ref(0)
const videoPlayer = ref(null)
const showEditDialog = ref(false)
const editingVideo = ref(null)
const panelCollapsed = ref(false)

const videoNaturalWidth = ref(0)
const videoNaturalHeight = ref(0)

const wrapperStyle = computed(() => {
    if (!videoNaturalWidth.value || !videoNaturalHeight.value) {
        return { aspectRatio: '16/9' }
    }
    const ar = videoNaturalWidth.value / videoNaturalHeight.value
    if (rotation.value % 180 === 90) {
        // 旋转90或270度，宽高比互换
        return { aspectRatio: (1 / ar).toFixed(4) }
    }
    return { aspectRatio: ar.toFixed(4) }
})

const videoStyle = computed(() => {
    return {
        transform: `rotate(${rotation.value}deg)`,
        transformOrigin: 'center center'
    }
})

onMounted(async () => {
    await loadVideo()
    await loadLikeInfo()
    await loadRecommend()
})

watch(() => route.params.id, async (newId, oldId) => {
    if (newId && newId !== oldId) {
        rotation.value = 0
        await loadVideo()
        await loadLikeInfo()
        await loadRecommend()
        window.scrollTo(0, 0)
    }
})

const onMetadata = () => {
    if (videoPlayer.value) {
        videoNaturalWidth.value = videoPlayer.value.videoWidth
        videoNaturalHeight.value = videoPlayer.value.videoHeight
    }
}

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
        const res = await likeApi.getCount(route.params.id)
        if (res.success) likeCount.value = res.data
    } catch (error) {
        console.error('加载点赞数失败:', error)
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

const doLike = async () => {
    try {
        const userToken = localStorage.getItem('userToken') || generateToken()
        const res = await likeApi.like(route.params.id, userToken)
        if (res.success) {
            likeCount.value++
            localStorage.setItem('userToken', userToken)
        }
    } catch (error) {
        console.error('点赞失败:', error)
    }
}

const rotateVideo = () => {
    rotation.value = (rotation.value + 90) % 360
}

const openEditDialog = () => {
    editingVideo.value = { ...video.value }
    showEditDialog.value = true
}

const onEditConfirm = () => {
    showEditDialog.value = false
    editingVideo.value = null
    loadVideo()
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
    overflow: hidden;
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

.no-video {
    aspect-ratio: 16/9;
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

.right-panel.collapsed .panel-toggle {
    left: -20px;
}

.action-section {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
}

.action-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 8px 12px;
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

.btn-icon {
    font-size: 15px;
}

.like-count {
    font-size: 12px;
    color: #999;
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
    padding: 6px 8px;
}

.recommend-name {
    font-size: 12px;
    color: #333;
    font-weight: bold;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.recommend-code {
    font-size: 11px;
    color: #999;
    margin-top: 2px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
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
