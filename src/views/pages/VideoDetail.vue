<template>
    <div class="video-detail" v-if="video">
        <div class="layout">
            <!-- 左侧：播放区 + 信息区 -->
            <div class="left-panel">
                <div class="player-section">
                    <div class="player-wrapper" :style="wrapperStyle">
                        <div v-if="video.id" id="ckplayer" ref="playerContainer"></div>
                        <div v-else class="no-video">暂无视频</div>
                        <div v-if="playerError" class="player-error">{{ playerError }}</div>
                        <!-- 音量提示 -->
                        <div v-if="volumeTipVisible" class="volume-tip">
                            <span>音量: {{ Math.round(currentVolume * 100) }}%</span>
                        </div>
                        <!-- 倍速提示 -->
                        <div v-if="speedTipVisible" class="volume-tip">
                            <span>倍速: {{ currentSpeed }}x</span>
                        </div>
                    </div>
                </div>
                <div class="info-section">
                    <div class="info-row1">
                        <span>{{ video.code ? video.code + ' ' + video.name : video.name }}</span>
                    </div>
                    <div class="info-row2">
                        <span v-if="video.country" class="tag tag--accent">{{ video.country }}</span>
                        <span v-if="video.category" class="tag tag--success">{{ video.category }}</span>
                        <span v-if="likeCount > 0" class="tag tag--like">♥ {{ likeCount }}</span>
                        <span class="tag tag--muted">{{ video.fileSize?formatSize(video.fileSize):'无文件' }}</span>
                    </div>
                    <!-- 片源拆成两维分开标：一行一维，再点一次当前值就是清掉这一维的结论 -->
                    <div class="info-row-media">
                        <span class="media-label">字幕：</span>
                        <button
                            v-for="opt in SUBTITLE_OPTIONS"
                            :key="opt.value"
                            type="button"
                            class="tag media-option"
                            :class="[subtitleClass(opt.value), { 'is-on': video.subtitleState === opt.value }]"
                            :title="SUBTITLE_STATES[opt.value]?.long"
                            :aria-pressed="video.subtitleState === opt.value"
                            @click="markSource('subtitle', opt.value)"
                        >{{ opt.label }}</button>
                    </div>
                    <div class="info-row-media">
                        <span class="media-label">广告水印：</span>
                        <button
                            v-for="opt in WATERMARK_OPTIONS"
                            :key="opt.value"
                            type="button"
                            class="tag media-option"
                            :class="[watermarkClass(opt.value), { 'is-on': video.watermarkState === opt.value }]"
                            :title="WATERMARK_STATES[opt.value]?.long"
                            :aria-pressed="video.watermarkState === opt.value"
                            @click="markSource('watermark', opt.value)"
                        >{{ opt.label }}</button>
                    </div>
                    <div class="info-row-media">
                        <span class="media-label">分辨率：</span>
                        <span v-if="video.resH" class="tag tag--info">{{ video.resW }}×{{ video.resH }}</span>
                        <span v-else class="media-unknown">未扫描</span>
                        <button
                            type="button"
                            class="tag media-option"
                            :disabled="scanning"
                            title="读这个视频文件的容器头量宽高（只读文件，不改文件；字幕和广告水印由你自己标）"
                            @click="scanThis"
                        >{{ scanning ? '扫描中…' : '扫描' }}</button>
                        <span v-if="!video.resH" class="media-unknown">点「扫描」量一次</span>
                    </div>
                    <!-- 只读元数据。填写都在「编辑」对话框里：详情页是看片的地方，
                         输入框混在信息区里既容易误改，也让这一屏看起来像没排完 -->
                    <dl v-if="video.originalName || video.releaseDate || studios.length" class="meta-grid">
                        <template v-if="video.originalName"><dt>原名</dt><dd>{{ video.originalName }}</dd></template>
                        <template v-if="video.releaseDate"><dt>发行</dt><dd>{{ video.releaseDate }}</dd></template>
                        <template v-if="studios.length">
                            <dt>片商</dt>
                            <dd>{{ studios.map((x) => x.name).join(' · ') }}</dd>
                        </template>
                    </dl>
                    <div class="info-row-media">
                        <span class="media-label">标签：</span>
                        <TokenPicker
                            v-model="tagPicked"
                            :options="tagOptions"
                            placeholder="输入题材标签"
                            chip-class="tag--info"
                            @change="saveTags"
                        />
                    </div>
                    <!-- 合辑导航：一部片是几部片子剪在一起时，从这里跳别部，不用回列表搜 -->
                    <div v-for="g in groups" :key="g.id" class="info-row-media">
                        <span class="media-label">合辑：</span>
                        <router-link
                            v-for="p in g.peers"
                            :key="p.id"
                            class="tag group-peer"
                            :class="{ 'is-current': p.id === video.id }"
                            :to="`/video/${p.id}`"
                        >{{ p.code || p.name }}</router-link>
                        <button type="button" class="tag media-option" @click="leaveGroup(g.id)">移出本组</button>
                    </div>
                    <div class="info-row-media">
                        <span class="media-label">关联：</span>
                        <template v-if="joining">
                            <input
                                v-model="groupName"
                                class="input meta-input"
                                placeholder="合辑名，回车加入"
                                @keyup.enter="joinGroup"
                                @keyup.esc="joining = false"
                            />
                            <button type="button" class="tag media-option" @click="joinGroup">加入</button>
                            <button type="button" class="tag media-option" @click="joining = false">取消</button>
                        </template>
                        <button v-else type="button" class="tag media-option" @click="joining = true">加入合辑…</button>
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
                        <button class="action-btn like-btn" @click="handleLike" :disabled="likeDisabled">
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
                        <button class="action-btn" @click="handlePictureInPicture">
                            <span>画中画</span>
                        </button>
                        <button class="action-btn" @click="resetFileSize" :disabled="resetting">
                            <span>重置</span>
                        </button>
                        <button class="action-btn" @click="handleDeleteFile" :disabled="deletingFile">
                            <span>删除文件</span>
                        </button>
                    </div>
                    <div class="recommend-section" v-if="recommendList.length > 0">
                        <h2 class="section-title">推荐视频</h2>
                        <div class="recommend-grid">
                            <VideoCard
                                v-for="item in recommendList"
                                :key="item.id"
                                :video="item"
                            />
                        </div>
                    </div>
                </template>
            </div>
        </div>

        <!-- 编辑弹窗：其中"删除"按钮触发的确认走全局反馈层（store/ui + AppOverlays） -->
        <AddVideoDialog
            :visible="showEditDialog"
            :editing-video="editingVideo"
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
import { useUiStore, errText } from '@/scripts/store/ui'
import AddVideoDialog from '@/views/components/AddVideoDialog.vue'
import VideoCard from '@/views/components/VideoCard.vue'
import { formatSize } from '@/scripts/utils/format'
import {
    SUBTITLE_STATES, WATERMARK_STATES, SUBTITLE_OPTIONS, WATERMARK_OPTIONS,
    subtitleClass, watermarkClass
} from '@/scripts/constants'
import { tagApi } from '@/scripts/api'
import TokenPicker from '@/views/components/TokenPicker.vue'
import { loadCkplayer } from '@/scripts/utils/ckplayer'

const route = useRoute()
const router = useRouter()
const ui = useUiStore()
const video = ref(null)
const actors = ref([])
const recommendList = ref([])
const rotation = ref(0)
const currentVolume = ref(1)  // 默认音量 1 (100%)
const STORAGE_KEY = 'ckplayer_volume'
const PLAYTIME_KEY_PREFIX = 'ckplayer_playtime_'

// 从本地存储加载音量
const loadVolume = () => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved !== null) {
        currentVolume.value = parseFloat(saved)
    }
}

// 获取视频播放时间
const getPlayTime = (videoId) => {
    const saved = localStorage.getItem(PLAYTIME_KEY_PREFIX + videoId)
    if (saved !== null) {
        return parseFloat(saved)
    }
    return 0
}

// 保存视频播放时间
const savePlayTime = (videoId, time) => {
    if (time > 5) {  // 只保存超过5秒的播放记录
        localStorage.setItem(PLAYTIME_KEY_PREFIX + videoId, time.toString())
    }
}

// 清除视频播放时间
const clearPlayTime = (videoId) => {
    localStorage.removeItem(PLAYTIME_KEY_PREFIX + videoId)
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
    
    // 数字键 1-9 设置倍速
    if (e.key >= '1' && e.key <= '9') {
        e.preventDefault()
        setSpeed(parseInt(e.key))
        return
    }
    
    // 数字键 0 重置为1倍速
    if (e.key === '0') {
        e.preventDefault()
        setSpeed(1)
        return
    }
    
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
const deletingFile = ref(false)
const likeDisabled = ref(false)
const volumeTipVisible = ref(false)
const speedTipVisible = ref(false)
const currentSpeed = ref(1)
let speedTipTimer = null

const marking = ref(false)
// 点当前选中的那颗等于清掉这一维（回到未标记），所以不额外做"清除"按钮
const markSource = async (dim, value) => {
    if (!video.value?.id) return
    const key = dim === 'subtitle' ? 'subtitleState' : 'watermarkState'
    const next = video.value[key] === value ? 'unknown' : value
    if (marking.value) return
    marking.value = true
    try {
        const res = await videoApi.updateSource(video.value.id, { [dim]: next })
        if (res.success) {
            video.value[key] = res.data[key]
            ui.success(next === 'unknown' ? '已清掉这一维' : '已记录')
        } else {
            ui.error('保存失败：' + errText(res, '未知错误'))
        }
    } catch (error) {
        console.error('保存片源标记失败:', error)
        ui.error('保存失败：' + errText(error))
    } finally {
        marking.value = false
    }
}

const scanning = ref(false)

// ---------------------------------------------------------------- 元数据：原名 / 发行日期 / 片商 / 标签 / 合辑

const tagPicked = ref([])
const tagOptions = ref([])
const groups = ref([])
const studios = ref([])

/**
 * 详情回来的一次性状态灌进三个可编辑控件。
 * 只在加载时调用，不做双向绑定：绑了的话用户改到一半、后台刷新会把半截输入冲掉。
 */
const applyMeta = (v) => {
    studios.value = v.studios || []
    tagPicked.value = (v.tags || []).map((t) => ({ id: t.id, name: t.name }))
    groups.value = v.groups || []
}

/** 词表整个拉到前端过滤：片商几百、标签几百，比每敲一个字问一次后端便宜 */
const loadVocab = async () => {
    try {
        const t = await tagApi.getList({ pageSize: 500 })
        if (t.success) tagOptions.value = t.data || []
    } catch (err) {
        console.error('加载词表失败:', err)
    }
}

const saveTags = async (list) => {
    try {
        const res = await videoApi.setTags(video.value.id, list.map((x) => x.name))
        if (!res.success) { ui.error(res.message || '没保存'); return }
        await loadVideo()
        await loadVocab()
        ui.success(res.message)
    } catch (err) { ui.error('保存失败：' + errText(err)) }
}

// 合辑名用行内输入，不用 window.prompt：prompt 是系统浅色框，而且没法校验
const joining = ref(false)
const groupName = ref('')

const joinGroup = async () => {
    const name = groupName.value.trim()
    if (!name) return
    joining.value = false
    groupName.value = ''
    try {
        const res = await videoApi.joinGroup(video.value.id, { name })
        if (res.success) { await loadVideo(); ui.success(res.message) } else ui.error(res.message || '没成功')
    } catch (err) { ui.error('没成功：' + errText(err)) }
}

const leaveGroup = async (groupId) => {
    const go = await ui.confirm({ title: '移出合辑', message: '只是把本片从这个合辑里摘出来，合辑和里面的其他影片都不动。', confirmLabel: '移出' })
    if (!go) return
    try {
        const res = await videoApi.leaveGroup(video.value.id, groupId)
        if (res.success) { await loadVideo(); ui.success(res.message) } else ui.error(res.message || '没成功')
    } catch (err) { ui.error('没成功：' + errText(err)) }
}
const scanThis = async () => {
    if (!video.value?.id || scanning.value) return
    scanning.value = true
    try {
        const res = await videoApi.scanOne(video.value.id)
        if (!res.success) {
            ui.warn(res.message || '没扫出来')
            return
        }
        // 扫描只回分辨率：字幕与广告水印两维不碰，那是人工结论
        video.value.resW = res.data.resW
        video.value.resH = res.data.resH
        video.value.scanTime = new Date().toLocaleString('zh-CN', { hour12: false })
        ui.success(res.message)
    } catch (error) {
        console.error('扫描失败:', error)
        ui.error('扫描失败：' + errText(error))
    } finally {
        scanning.value = false
    }
}
let volumeTipTimer = null

const videoNaturalWidth = ref(0)
const videoNaturalHeight = ref(0)
const playerContainer = ref(null)
const playerError = ref('')
let ckplayerInstance = null

// 播放器相关的延时任务统一登记，离开页面时一次清干净
const playerTimers = []
const later = (fn, delay) => {
    const id = setTimeout(fn, delay)
    playerTimers.push(id)
    return id
}
const clearPlayerTimers = () => {
    playerTimers.forEach(clearTimeout)
    playerTimers.length = 0
}

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

const subtitleInfo = ref(null)

const initCkplayer = async () => {
    if (!video.value?.id) return

    playerError.value = ''

    // 销毁旧实例
    if (ckplayerInstance) {
        try {
            ckplayerInstance.remove()
        } catch (e) {
            console.warn('销毁播放器失败:', e)
        }
        ckplayerInstance = null
    }

    // 检查字幕
    try {
        const subRes = await videoApi.checkSubtitle(video.value.code)
        if (subRes.success && subRes.hasSubtitle) {
            subtitleInfo.value = subRes
        } else {
            subtitleInfo.value = null
        }
    } catch (e) {
        console.warn('检查字幕失败:', e)
        subtitleInfo.value = null
    }

    // 封面图片
    const poster = video.value.coverPath
        ? `/api/video/cover/${video.value.id}`
        : ''

    // 记忆播放位置
    const savedPlayTime = video.value.fileSize ? getPlayTime(video.value.id) : 0

    // 文件不存在时视频地址为空，由 ckplayer 自动显示封面
    const videoUrl = video.value.fileSize ? videoApi.getStreamUrl(video.value.id) : ''

    const videoObject = {
        container: '#ckplayer',
        variable: 'player',
        autoplay: false,
        video: videoUrl,
        screenshot: true,
        poster: poster,
        seek: savedPlayTime
    }

    // 如果有字幕，添加 track 配置
    if (subtitleInfo.value) {
        videoObject.track = [{
            src: subtitleInfo.value.url,
            srclang: 'zh',
            kind: 'subtitles',
            label: '中文字幕',
            default: true
        }]
    }

    // 播放器只在进详情页时才用得到，改为按需注入（原先挂在 index.html 里阻塞所有页面）
    let Ckplayer
    try {
        Ckplayer = await loadCkplayer()
    } catch (err) {
        console.error('播放器加载失败:', err)
        playerError.value = '播放器加载失败，请刷新页面重试'
        return
    }

    ckplayerInstance = new Ckplayer(videoObject)

    // 下面几个延时都要在离开页面时清掉，否则卸载后仍会往陈旧 id 上写播放进度
    if (currentVolume.value !== 1) {
        later(() => setVolume(currentVolume.value), 500)
    }

    // 监听播放时间并保存播放进度
    later(() => {
        if (!ckplayerInstance) return
        ckplayerInstance.time((currentTime) => {
            later(() => {
                if (video.value?.id) savePlayTime(video.value.id, currentTime)
            }, 10000)
        })
    }, 1000)

    // 获取视频元数据
    later(() => {
        const videoEl = document.querySelector('#ckplayer video')
        if (videoEl) {
            if (videoEl.videoWidth && videoEl.videoHeight) {
                videoNaturalWidth.value = videoEl.videoWidth
                videoNaturalHeight.value = videoEl.videoHeight
            } else {
                videoEl.addEventListener('loadedmetadata', () => {
                    videoNaturalWidth.value = videoEl.videoWidth || 1920
                    videoNaturalHeight.value = videoEl.videoHeight || 1080
                })
            }
        }
    }, 500)
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

// 设置播放倍速
const setSpeed = (speed) => {
    currentSpeed.value = speed
    if (ckplayerInstance) {
        try {
            ckplayerInstance.playbackRate(speed)
        } catch (e) {
            console.warn('设置倍速失败:', e)
        }
    }
    showSpeedTip()
}

// 显示倍速提示
const showSpeedTip = () => {
    speedTipVisible.value = true
    clearTimeout(speedTipTimer)
    speedTipTimer = setTimeout(() => {
        speedTipVisible.value = false
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
    clearTimeout(speedTipTimer)
    clearPlayerTimers()
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
            applyMeta(video.value)

            // 初始化 ckplayer
            nextTick(async () => {
                await initCkplayer()
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
            if (res.data?.filePath !== undefined) video.value.file_path = res.data.filePath
            if (res.data?.fileSize !== undefined) video.value.fileSize = res.data.fileSize
            if (res.data?.coverPath !== undefined) video.value.cover_path = res.data.coverPath
            video.value.subtitleState = 'unknown'
            video.value.watermarkState = 'unknown'
            video.value.resW = 0
            video.value.resH = 0
            video.value.scanTime = null
            ui.success('已重置')
        } else {
            ui.error('重置失败：' + errText(res, '未知错误'))
        }
    } catch (error) {
        console.error('重置失败:', error)
        ui.error('重置失败：' + errText(error))
    }
    resetting.value = false
}

// 删除视频文件
const handleDeleteFile = async () => {
    if (!video.value?.id) return
    const go = await ui.confirm({
        title: '删除视频文件',
        message: '确定要删除视频文件吗？封面不会受影响。',
        danger: true
    })
    if (!go) return
    deletingFile.value = true
    try {
        const res = await videoApi.deleteVideoFile(video.value.id)
        if (res.success) {
            video.value.file_path = null
            video.value.fileSize = 0
            ui.success('已删除文件')
        } else {
            ui.error('删除失败：' + errText(res, '未知错误'))
        }
    } catch (error) {
        console.error('删除失败:', error)
        ui.error('删除失败：' + errText(error))
    }
    deletingFile.value = false
}

// 画中画
const handlePictureInPicture = async () => {
    const videoEl = document.querySelector('#ckplayer video')
    if (!videoEl) {
        console.warn('video 元素未找到')
        return
    }
    try {
        if (document.pictureInPictureElement) {
            await document.exitPictureInPicture()
        } else {
            await videoEl.requestPictureInPicture()
        }
    } catch (error) {
        console.error('画中画失败:', error)
    }
}

const onEditSave = async (formData) => {
    try {
        await videoApi.update(video.value.id, formData)
        showEditDialog.value = false
        editingVideo.value = null
        await loadVideo()
        ui.success('已保存')
    } catch (error) {
        console.error('保存失败:', error)
        ui.error('保存失败：' + errText(error))
    }
}

// 删除：必须让调用方显式选择是否连文件一起删。
// 服务端 deleteFiles 默认已是 false，但这里仍然显式传值，避免依赖默认。
const askDeleteChoice = (label) =>
    ui.ask({
        title: '确认删除',
        message: `删除后不可恢复。${label}磁盘上的视频文件要一起删掉吗？`,
        actions: [
            { value: 'deleteRecordOnly', label: '仅删记录' },
            { value: 'deleteAll', label: '删除记录和文件', danger: true }
        ]
    })

const onDeleteVideo = async (videoId) => {
    const name = editingVideo.value?.name
    const choice = await askDeleteChoice(name ? `「${name}」` : '')
    if (choice === 'cancel') return
    try {
        clearPlayTime(videoId)  // 清除播放记录
        await videoApi.delete(videoId, { deleteFiles: choice === 'deleteAll' })
        router.push('/')
        ui.success('已删除')
    } catch (error) {
        console.error('删除失败:', error)
        ui.error('删除失败：' + errText(error))
    }
}

const goToSeries = (id) => {
    router.push(`/series/${id}`)
}

const goToActor = (id) => {
    router.push(`/actor/${id}`)
}

const handleLike = async () => {
    if (likeDisabled.value) return
    likeDisabled.value = true
    try {
        const res = await videoApi.like(video.value.id)
        if (res.success) {
            likeCount.value = res.likeCount
            // 观影日历挂在 App 上，不会自己知道点赞发生了
            window.dispatchEvent(new CustomEvent('likesUpdated', { detail: { id: video.value.id } }))
        }
    } catch (error) {
        console.error('点赞失败:', error)
    } finally {
        setTimeout(() => { likeDisabled.value = false }, 3000)
    }
}

// formatSize 已迁移至 @/scripts/utils/format.js
</script>

<style scoped>
.video-detail {
    width: 100%;
    max-width: var(--container);
    margin: 0 auto;
    padding: var(--s4) var(--s5) var(--s7);
    display: flex;
    flex-direction: column;
    gap: var(--s4);
}

.layout {
    display: flex;
    gap: var(--s4);
    align-items: flex-start;
}

.left-panel {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: var(--s3);
}

.player-section {
    width: 100%;
    background: #000;
    border-radius: var(--r2);
    overflow: visible;
}

.player-wrapper {
    width: 100%;
    max-height: 520px;
    position: relative;
    background: #000;
    border-radius: var(--r2);
    overflow: hidden;
}

.player-wrapper video,
.player-wrapper #ckplayer {
    width: 100%;
    height: 100%;
    display: block;
}

/* ckplayer 自己的控制条是 z-index:260 的绝对定位层，会越过页面的 --z-dialog(200)
   盖到确认弹窗上。给它一个自己的层叠上下文，把那 260 关在容器里。 */
.player-wrapper #ckplayer {
    position: relative;
    z-index: 0;
}

.player-wrapper video {
    object-fit: contain;
}

.no-video {
    aspect-ratio: 16 / 9;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-faint);
    font-size: var(--f-lg);
}

.player-error {
    position: absolute;
    left: 50%;
    bottom: 18%;
    transform: translateX(-50%);
    padding: 6px 14px;
    border-radius: var(--r1);
    background: var(--danger-soft);
    border: 1px solid var(--danger);
    color: var(--danger);
    font-size: var(--f-sm);
    white-space: nowrap;
}

.volume-tip {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    padding: 10px 22px;
    border-radius: var(--r2);
    background: rgba(0, 0, 0, .75);
    color: #fff;
    font-size: var(--f-lg);
    pointer-events: none;
    z-index: 20;
}

/* ==================== 信息区 ==================== */

.info-section {
    display: flex;
    flex-direction: column;
    gap: var(--s2);
}

.info-row1 {
    font-size: var(--f-xl);
    font-weight: 650;
    line-height: 1.35;
}

.info-row2 {
    display: flex;
    align-items: center;
    gap: var(--s2);
    flex-wrap: wrap;
    font-size: var(--f-md);
    color: var(--text-dim);
}

.info-row3,
.info-row4 {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 6px;
    font-size: var(--f-md);
    color: var(--text-dim);
}

.actor-link {
    color: var(--info);
    cursor: pointer;
}

.actor-link:hover {
    text-decoration: underline;
}

/* 片源标记 */
.info-row-media {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
    font-size: var(--f-sm);
}

.media-label {
    color: var(--text-faint);
}

/* 芯片外形走全局 .tag，这里只补"可点选择"这一层交互态 */
.media-option {
    border-color: var(--border);
    color: var(--text-dim);
    cursor: pointer;
}

/* 当前结论那颗：描边取自己的文字色（有语气的 tag--* 会带出色来），再加一圈同色内描边，
   这样"选中的是哪颗"不只有颜色一个线索 */
.media-option.is-on {
    border-color: currentColor;
    box-shadow: inset 0 0 0 1px currentColor;
    font-weight: 600;
}

.media-unknown {
    color: var(--text-faint);
    font-size: var(--f-xs);
}

/* 只读元数据：标签列定宽对齐，值长的原名自己换行 */
.meta-grid {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: var(--s1) var(--s3);
    margin: 0;
    font-size: var(--f-sm);
}

.meta-grid dt {
    color: var(--text-faint);
    white-space: nowrap;
}

.meta-grid dd {
    margin: 0;
    color: var(--text-dim);
    overflow-wrap: anywhere;
}

/* 合辑导航：当前这部高亮，其余可点跳转 */
.group-peer {
    cursor: pointer;
}

.group-peer.is-current {
    border-color: currentColor;
    color: var(--accent);
    font-weight: 600;
    pointer-events: none;
}

/* ==================== 右侧面板 ==================== */

.right-panel {
    width: 300px;
    flex-shrink: 0;
    position: relative;
    display: flex;
    flex-direction: column;
    gap: var(--s5);
    transition: width var(--dur) var(--ease), opacity var(--dur) var(--ease);
    overflow: hidden;
}

.right-panel.collapsed {
    width: 0;
    opacity: 0;
    gap: 0;
}

.panel-toggle {
    position: absolute;
    left: -22px;
    top: 50%;
    transform: translateY(-50%);
    width: 22px;
    height: 62px;
    display: grid;
    place-items: center;
    border-radius: var(--r1) 0 0 var(--r1);
    background: var(--bg-elev);
    border: 1px solid var(--border);
    border-right: none;
    color: var(--text-dim);
    font-size: var(--f-xs);
    cursor: pointer;
    z-index: 10;
}

.panel-toggle:hover {
    background: var(--bg-elev-2);
    color: var(--text);
}

.action-section {
    display: flex;
    gap: var(--s2);
    flex-wrap: wrap;
}

.action-btn {
    width: calc(25% - 6px);
    height: 34px;
    display: grid;
    place-items: center;
    border: 1px solid var(--border);
    border-radius: var(--r1);
    background: var(--bg-elev);
    color: var(--text-dim);
    font-size: var(--f-sm);
    cursor: pointer;
    transition: color var(--dur) var(--ease), border-color var(--dur) var(--ease),
      background var(--dur) var(--ease);
}

.action-btn:hover:not(:disabled) {
    color: var(--accent);
    border-color: var(--accent);
    background: var(--accent-soft);
}

.action-btn:disabled {
    opacity: .5;
    cursor: not-allowed;
}

.action-btn.like-btn {
    color: var(--like);
    border-color: var(--like);
}

.action-btn.like-btn:hover:not(:disabled) {
    background: var(--like-soft);
    border-color: var(--like);
    color: var(--like);
}

.recommend-section {
    display: flex;
    flex-direction: column;
    gap: var(--s3);
}

.recommend-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--s2);
}

@media (max-width: 900px) {
    .video-detail {
        padding: var(--s3) var(--s3) var(--s6);
    }

    .layout {
        flex-direction: column;
    }

    .right-panel,
    .right-panel.collapsed {
        width: 100%;
        opacity: 1;
    }

    .panel-toggle {
        display: none;
    }
}
</style>
