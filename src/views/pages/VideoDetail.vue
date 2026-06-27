<template>
    <div class="video-detail" v-if="video">
        <div class="layout">
            <!-- 左侧：播放区 + 信息区 -->
            <div class="left-panel">
                <div class="player-section">
                    <div class="player-wrapper" :style="wrapperStyle">
                        <video
                            v-if="video.id"
                            ref="videoPlayer"
                            :src="`/api/video/stream/${video.id}`"
                            controls
                            @loadedmetadata="onMetadata"
                            :style="videoStyle"
                        ></video>
                        <div v-else class="no-video">暂无视频</div>
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
import { ref, onMounted, computed, watch } from 'vue'
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
const videoPlayer = ref(null)
const showEditDialog = ref(false)
const editingVideo = ref(null)
const panelCollapsed = ref(false)
const likeCount = ref(0)
const resetting = ref(false)

const videoNaturalWidth = ref(0)
const videoNaturalHeight = ref(0)

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

const videoStyle = computed(() => {
    return {
        transform: `rotate(${rotation.value}deg)`,
        transformOrigin: 'center center'
    }
})

onMounted(async () => {
    await loadVideo()
    await loadRecommend()
})

watch(() => route.params.id, async (newId, oldId) => {
    if (newId && newId !== oldId) {
        rotation.value = 0
        await loadVideo()
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
            video.value = res.data.video || res.data
            actors.value = res.data.actors || []
            likeCount.value = res.data.likeCount || 0
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

const rotateVideo = () => {
    rotation.value = (rotation.value + 90) % 360
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
