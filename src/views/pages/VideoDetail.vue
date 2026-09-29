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
                        <!-- 有版本名称时标题就用它（解说版当初录的那条标题本来就是"这一版叫什么"），
                             不再另起一行「版本标题」——那一行把主标题的层级拆散了。
                             番号仍是影片层的番号，它是这部片的身份，不随版本变 -->
                        <span>{{ video.code ? video.code + ' ' : '' }}{{ shown.label || video.name }}</span>
                    </div>
                    <div class="info-row2">
                        <span v-if="video.country" class="tag tag--accent">{{ video.country }}</span>
                        <span v-if="video.category" class="tag tag--success">{{ video.category }}</span>
                        <span v-if="likeCount > 0" class="tag tag--like">♥ {{ likeCount }}</span>
                        <span class="tag tag--muted">{{ shown.fileSize ? formatSize(shown.fileSize) : '无文件' }}</span>
                    </div>
                    <!-- 版本（v11）：一部片名下一份文件一行。下拉只切"现在看哪一版"，改的是播放器与下面几行；
                         「设为默认」才动影片口径（列表筛选与统计跟着那一版走），所以它单独要二次确认。
                         只有一版时不摆下拉——大多数片就是原版，一个只有一个项的选择框是添乱。 -->
                    <!-- 信息区统一成「定宽标签 + 值」两列一行的清单，标签一律不带冒号。
                         三档：版本 → 这一版片源（字幕 / 水印 / 分辨率）→ 档案（含演员年龄） -->
                    <div class="kv-list">
                        <div v-if="versions.length" class="kv">
                            <span class="kv__k">版本</span>
                            <div class="kv__v">
                                <SelectList
                                    v-if="versions.length > 1"
                                    v-model="activeFileId"
                                    :options="versionOptions"
                                    label="切换播放的版本"
                                />
                                <span v-else class="tag tag--muted">{{ active.displayName || '原版' }}</span>
                                <button
                                    v-if="versions.length > 1 && active && !active.isDefault"
                                    type="button"
                                    class="tag media-option"
                                    title="让列表筛选与统计按这一版走"
                                    @click="makeDefault"
                                >
设为默认
</button>
                                <button type="button" class="tag media-option" @click="openVersionDialog()">加一版</button>
                                <!-- 改这版：单版本时也要能改（原版的文件名标识同样可能需要修） -->
                                <button
                                    type="button"
                                    class="tag media-option"
                                    title="改这一版的名称、类型、文件名标识与路径（只改库里的记录）"
                                    @click="openVersionDialog(active)"
                                >
改这版
</button>
                                <button
                                    v-if="versions.length > 1 && active && !active.isDefault"
                                    type="button"
                                    class="tag media-option"
                                    title="只删这一版的记录，盘上文件留着"
                                    @click="removeActive"
                                >
删这版
</button>
                            </div>
                        </div>
                        <!-- 已经有结论就只留结论：四颗胶囊并排是"还没标"时的样子，
                             看片时那一屏只需要答案。标错了不在这里改 —— 走右上角「重置」，
                             它把两维与分辨率一起清空，回到没标过的状态重填 -->
                        <div class="kv">
                            <span class="kv__k">字幕</span>
                            <div class="kv__v">
                                <span
                                    v-if="shown.subtitleState !== 'unknown'"
                                    class="tag"
                                    :class="subtitleClass(shown.subtitleState)"
                                    :title="SUBTITLE_STATES[shown.subtitleState]?.long"
                                >
{{ subtitleText(shown.subtitleState) }}
</span>
                                <template v-else>
                                    <button
                                        v-for="opt in SUBTITLE_MARK_OPTIONS"
                                        :key="opt.value"
                                        type="button"
                                        class="tag media-option"
                                        :class="subtitleClass(opt.value)"
                                        :title="SUBTITLE_STATES[opt.value]?.long"
                                        @click="markSource('subtitle', opt.value)"
                                    >
{{ opt.label }}
</button>
                                </template>
                            </div>
                        </div>
                        <div class="kv">
                            <span class="kv__k">广告水印</span>
                            <div class="kv__v">
                                <span
                                    v-if="shown.watermarkState !== 'unknown'"
                                    class="tag"
                                    :class="watermarkClass(shown.watermarkState)"
                                    :title="WATERMARK_STATES[shown.watermarkState]?.long"
                                >
{{ watermarkText(shown.watermarkState) }}
</span>
                                <template v-else>
                                    <button
                                        v-for="opt in WATERMARK_MARK_OPTIONS"
                                        :key="opt.value"
                                        type="button"
                                        class="tag media-option"
                                        :class="watermarkClass(opt.value)"
                                        :title="WATERMARK_STATES[opt.value]?.long"
                                        @click="markSource('watermark', opt.value)"
                                    >
{{ opt.label }}
</button>
                                </template>
                            </div>
                        </div>
                        <div class="kv">
                            <span class="kv__k">分辨率</span>
                            <div class="kv__v">
                                <span v-if="shown.resH" class="tag tag--info">{{ shown.resW }}×{{ shown.resH }}</span>
                                <template v-else>
                                    <span class="media-unknown">未扫描</span>
                                    <!-- 量出来就不再摆这颗按钮：重复扫只会得到同一个数，
                                         真要重量的先换文件（重置片源会连分辨率一起清空） -->
                                    <button
                                        type="button"
                                        class="tag media-option"
                                        :disabled="scanning"
                                        title="读这一版的视频文件容器头量宽高（只读文件，不改文件；字幕和广告水印由你自己标）"
                                        @click="scanThis"
                                    >
{{ scanning ? '扫描中…' : '扫描' }}
</button>
                                </template>
                            </div>
                        </div>
                        <!-- 以下都是只读档案，填写在「编辑」对话框里：详情页是看片的地方，
                             输入框混在信息区里既容易误改，也让这一屏看起来像没排完 -->
                        <div v-if="video.originalName" class="kv">
                            <span class="kv__k">原名</span>
                            <div class="kv__v">{{ video.originalName }}</div>
                        </div>
                        <div v-if="video.releaseDate" class="kv">
                            <span class="kv__k">发行</span>
                            <div class="kv__v">{{ video.releaseDate }}</div>
                        </div>
                        <div v-if="video.studioName" class="kv">
                            <span class="kv__k">片商</span>
                            <div class="kv__v">
                                <!-- 填了官网才成链接：站外地址一律新标签 + noreferrer -->
                                <a v-if="video.studioLink" class="actor-link" :href="video.studioLink"
                                   target="_blank" rel="noreferrer">{{ video.studioName }}</a>
                                <template v-else>{{ video.studioName }}</template>
                            </div>
                        </div>
                        <div v-if="video.seriesName" class="kv">
                            <span class="kv__k">系列</span>
                            <div class="kv__v">
                                <a :key="video.seriesId" class="actor-link" @click="goToSeries(video.seriesId)">{{ video.seriesName }}</a>
                            </div>
                        </div>
                        <div v-if="actors.length" class="kv">
                            <span class="kv__k">演员</span>
                            <div class="kv__v">
                                <a
                                    v-for="actor in actors"
                                    :key="actor.id"
                                    class="actor-link"
                                    :title="actor.birthdate ? `${actor.birthdate} 出生` : ''"
                                    @click="goToActor(actor.id)"
                                >
{{ actor.name }}<em v-if="ageAt(video.releaseDate, actor.birthdate)" class="actor-age">{{ ageAt(video.releaseDate, actor.birthdate) }} 岁</em>
</a>
                            </div>
                        </div>
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

        <!-- 加一版 / 改这版 同一个弹窗：字段一样，改的时候多一句"盘上现在叫什么" -->
        <AddVersionDialog
            :visible="showVersionDialog"
            :video="video"
            :versions="versions"
            :version="versionEditing"
            @saved="onVersionSaved"
            @error="(m) => ui.error(m)"
            @cancel="closeVersionDialog"
        />

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
import AddVersionDialog from '@/views/components/AddVersionDialog.vue'
import SelectList from '@/views/components/SelectList.vue'
import VideoCard from '@/views/components/VideoCard.vue'
import { formatSize, ageAt } from '@/scripts/utils/format'
import {
    SUBTITLE_STATES, WATERMARK_STATES, SUBTITLE_MARK_OPTIONS, WATERMARK_MARK_OPTIONS,
    subtitleClass, watermarkClass, subtitleText, watermarkText
} from '@/scripts/constants'
import { loadCkplayer } from '@/scripts/utils/ckplayer'

const route = useRoute()
const router = useRouter()
const ui = useUiStore()
const video = ref(null)
// 文件层（v11）：一部片名下每份文件一行。activeFileId 是"现在看哪一版"，
// 与"哪一版是影片口径"（isDefault）是两件事，后者只有「设为默认」会改
const versions = ref([])
const activeFileId = ref('')
const showVersionDialog = ref(false)

const active = computed(() => versions.value.find((v) => v.id === activeFileId.value) || versions.value[0] || null)
// 信息区与播放器都读这一份：没有版本行时退回影片对象（旧数据/异常兜底，不让页面空白）
const shown = computed(() => active.value || video.value || {})
const versionOptions = computed(() => {
    // 下拉里只放短名：类型名（湿姐）或"原版"，默认那一版标出来，长标题走副标题那一行。
    // 但同一部片可能有两版都挂在同一个类型下（那四家频道的尾巴都是 C），
    // 这时光看名字选不出区别，就在重名的那几项后面补上行级番号把它们分开
    const names = versions.value.map((v) => v.displayName || '原版')
    const dup = new Set(names.filter((n, i) => names.indexOf(n) !== i))
    return versions.value.map((v) => {
        const name = v.displayName || '原版'
        const tail = dup.has(name) && v.code ? ` · ${v.code}` : ''
        return { value: v.id, label: `${name}${tail}${v.isDefault ? ' · 默认' : ''}` }
    })
})

const versionEditing = ref(null)

/** 传行就是改这一版，不传就是加一版 */
const openVersionDialog = (row = null) => {
    versionEditing.value = row || null
    showVersionDialog.value = true
}

const closeVersionDialog = () => {
    showVersionDialog.value = false
    versionEditing.value = null
}

const onVersionSaved = async (payload) => {
    closeVersionDialog()
    await loadVideo()
    ui.success(payload?.isEdit ? '已保存这一版' : '版本已添加')
    // 改了文件名标识不等于盘上文件跟着改名：库里认新标识、盘上还是旧名字，
    // 这两步分开才不会出现"填错一格就把 20GB 的文件重命名"
    if (payload?.codeChanged) await offerAlignName(payload.version)
}

/**
 * 提议把这一版盘上的文件名改成新的行级标识。
 * 一律先预检（后端 dryRun 默认 true）把"会改成什么名"回出来给人看，确认了才执行。
 * 不确认就把话说清：两边现在不一致，影片列表里的「校验文件名」会把它列进待办。
 */
const offerAlignName = async (row) => {
    if (!row?.id) return
    if (!row.filePath) {
        ui.info('这一版还没有文件，改标识不用改名')
        return
    }
    let pre
    try {
        pre = await videoApi.alignVersionName(row.id, true)
    } catch (error) {
        console.error('文件名预检失败:', error)
        return ui.error('预检失败：' + errText(error))
    }
    if (!pre?.success) return ui.warn(pre?.message || '这一版不用改名')
    if (!pre.changed) return ui.info(pre.message || '文件名已经与新标识一致，不用动')

    const go = await ui.confirm({
        title: '把盘上的文件也改成新标识？',
        message: `${pre.message}。库里已经先改好了，这一步只动这一个文件；不改的话两边会不一致，`
            + '影片列表里的「校验文件名」会把它列进待办。',
        danger: true,
        confirmLabel: '执行改名'
    })
    if (!go) return ui.warn('只改了库里的标识，盘上文件名没动')
    try {
        const done = await videoApi.alignVersionName(row.id, false)
        if (done?.success && done.changed) {
            await loadVideo()
            ui.success(done.message || '已改名')
        } else {
            ui.warn(done?.message || '没改成')
        }
    } catch (error) {
        console.error('改名失败:', error)
        ui.error('改名失败：' + errText(error))
    }
}

// 设为影片口径：一次切换会连带改掉列表筛选结果与全站统计，所以必须二次确认
const makeDefault = async () => {
    const v = active.value
    if (!v) return
    const go = await ui.confirm({
        title: '设为默认版本',
        message: `列表筛选、统计和卡片上的分辨率与大小都会跟着「${v.displayName}」这一版走，`
            + `原来是「${defaultName.value}」。确定要换吗？`
    })
    if (!go) return
    try {
        const res = await videoApi.setDefaultVersion(v.id)
        if (!res?.success) return ui.error(res?.message || '设置失败')
        await loadVideo()
        ui.success(res.message || '已设为默认版本')
    } catch (error) {
        console.error('设为默认失败:', error)
        ui.error('设置失败：' + errText(error))
    }
}

const defaultName = computed(() => versions.value.find((v) => v.isDefault)?.displayName || '原版')

// 删掉这一版：只剩一版时后端会拒绝（影片没有默认版本，列表筛选与统计会当场失去依据）
const removeActive = async () => {
    const v = active.value
    if (!v) return
    const go = await ui.confirm({
        title: '删除这一版',
        message: `只删库里的版本记录，盘上的文件留着；指向「${v.displayName}」的点赞记录会一起清掉。`,
        danger: true
    })
    if (!go) return
    try {
        const res = await videoApi.deleteVersion(v.id)
        if (!res?.success) return ui.error(res?.message || '删除失败')
        await loadVideo()
        ui.success(res.message || '已删除')
    } catch (error) {
        console.error('删除版本失败:', error)
        ui.error('删除失败：' + errText(error))
    }
}

const actors = ref([])
const recommendList = ref([])
const rotation = ref(0)
const currentVolume = ref(1)  // 默认音量 1 (100%)
const STORAGE_KEY = 'ckplayer_volume'
const PLAYTIME_KEY_PREFIX = 'ckplayer_playtime_'
// 进度按**版本行**记（v11）：原版 119 分钟、解说版 21 分钟，共用一个偏移的话切回来必然错位。
// 旧数据是按影片 id 存的，兜底只交给"最可能就是它"的那一版——默认版，或这部片只有一版。
// 每个版本都去继承一次，就等于把这次要修的串位又造回来了。
const legacyPlayTimeKey = (movieId) => (movieId ? PLAYTIME_KEY_PREFIX + movieId : '')
const canClaimLegacy = (row) => !!row.isDefault || versions.value.length <= 1

// 从本地存储加载音量
const loadVolume = () => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved !== null) {
        currentVolume.value = parseFloat(saved)
    }
}

// 获取视频播放时间：先读这一版自己的键，没有再读这部片的老键
const getPlayTime = (fileId, movieId, legacy) => {
    const keys = [PLAYTIME_KEY_PREFIX + fileId, legacy ? legacyPlayTimeKey(movieId) : ''].filter(Boolean)
    for (const key of keys) {
        const saved = localStorage.getItem(key)
        if (saved !== null) {
            const n = parseFloat(saved)
            if (Number.isFinite(n) && n >= 0) return n
        }
    }
    return 0
}

// 保存视频播放时间：只落在这一版自己的键上。
// 接管老键的这一版一旦开始自己记，就把老键删掉——留着会被别的版本再继承一次
const savePlayTime = (fileId, time, owner) => {
    if (!fileId || time <= 5) return   // 只保存超过5秒的播放记录
    localStorage.setItem(PLAYTIME_KEY_PREFIX + fileId, time.toString())
    if (owner?.legacy) localStorage.removeItem(legacyPlayTimeKey(owner.movieId))
}

// 清除视频播放时间（删片时把这部片所有版本的记录一起清，留着就是没人读的垃圾键）
const clearPlayTime = (videoId) => {
    localStorage.removeItem(PLAYTIME_KEY_PREFIX + videoId)
    versions.value.forEach((v) => localStorage.removeItem(PLAYTIME_KEY_PREFIX + v.id))
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
    // 两维是"这一份文件"的结论：解说版有没有字幕，和原版有没有字幕是两回事
    const fileId = shown.value.id
    if (!fileId) return
    const key = dim === 'subtitle' ? 'subtitleState' : 'watermarkState'
    const next = shown.value[key] === value ? 'unknown' : value
    if (marking.value) return
    marking.value = true
    try {
        const res = await videoApi.updateSource(fileId, { [dim]: next })
        if (res.success) {
            active.value[key] = res.data[key]
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

// ---------------------------------------------------------------- 元数据：原名 / 发行日期 / 片商

const scanThis = async () => {
    const fileId = shown.value.id
    if (!fileId || scanning.value) return
    scanning.value = true
    try {
        const res = await videoApi.scanOne(fileId)
        if (!res.success) {
            ui.warn(res.message || '没扫出来')
            return
        }
        // 扫描只回分辨率：字幕与广告水印两维不碰，那是人工结论
        active.value.resW = res.data.resW
        active.value.resH = res.data.resH
        active.value.scanTime = new Date().toLocaleString('zh-CN', { hour12: false })
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
// 播放器时间回调只更新这里的最新值，由固定的 flush 落盘（见 every()）
let latestTime = 0
// 当前在放的是哪一版（{ fileId, movieId, legacy }）：销毁后离开页面时还要靠它补记最后一段
let playingOwner = null

// 播放器相关的延时任务统一登记，离开页面时一次清干净
const playerTimers = []
const later = (fn, delay) => {
    const id = setTimeout(fn, delay)
    playerTimers.push(id)
    return id
}
// 周期任务：进度落盘用固定的 flush，不用每次时间回调都挂一个延时（那样切一次版本就攒一堆
// 待落地的定时器，每个都可能往陈旧的版本键上写）
const every = (fn, ms) => {
    const id = setInterval(fn, ms)
    playerTimers.push(id)
    return id
}
const clearPlayerTimers = () => {
    playerTimers.forEach((id) => {
        clearTimeout(id)
        clearInterval(id)
    })
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

/**
 * 拆掉当前播放器：先停掉所有延时/周期任务，再把每个 video 元素停下来并断源，
 * 最后清容器——ckplayer 的 remove() 成不成功都不影响这一步。
 *
 * 原来只调 remove() 且异常被 catch 吞掉：播放中切版本时它抛错，旧 video 就留在页面里继续出声，
 * 新实例再建一个 → 两版同时播、两路声音叠加（2026-09-30 反馈）。
 * 先 pause+断源 再 remove：remove 可能已经把节点摘下，那时再去 pause 就晚了。
 */
const destroyPlayer = () => {
    clearPlayerTimers()
    const box = document.querySelector('#ckplayer')
    box?.querySelectorAll('video').forEach((el) => {
        try { el.pause() } catch { /* 已脱离文档，忽略 */ }
        try { el.removeAttribute('src'); el.load() } catch { /* 同上 */ }
    })
    if (ckplayerInstance) {
        try {
            ckplayerInstance.remove()
        } catch (e) {
            console.warn('ckplayer remove() 报错，容器仍强制清空:', e)
        }
        ckplayerInstance = null
    }
    if (box) box.innerHTML = ''
    latestTime = 0
}

// 切版本会连着触发两次重建（下拉点得快 / 保存后 loadVideo 又来一次）；
// 上面那些 await 让两轮交叠时，两边都会 new 一个实例 → 又是两个播放器。用序号让后到的作废。
let playerSeq = 0

const initCkplayer = async () => {
    if (!video.value?.id) return
    const seq = ++playerSeq

    playerError.value = ''
    destroyPlayer()

    // 检查字幕：字幕文件名跟的是**这一版的文件名标识**（ATID-428C 有它自己的一份）
    try {
        const subRes = await videoApi.checkSubtitle(shown.value.code || video.value.code)
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

    // 取流与进度都按**这一版**（v11）
    const cur = shown.value
    const owner = { fileId: cur.id, movieId: video.value.id, legacy: canClaimLegacy(cur) }
    const savedPlayTime = cur.fileSize ? getPlayTime(cur.id, video.value.id, owner.legacy) : 0

    // 文件不存在时视频地址为空，由 ckplayer 自动显示封面
    const videoUrl = cur.fileSize ? videoApi.getStreamUrl(cur.id) : ''

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

    if (seq !== playerSeq) return   // 这轮建到一半又被切了一次，旧的这轮直接作废
    ckplayerInstance = new Ckplayer(videoObject)

    // 下面几个延时都要在离开页面时清掉，否则卸载后仍会往陈旧 id 上写播放进度
    if (currentVolume.value !== 1) {
        later(() => setVolume(currentVolume.value), 500)
    }

    // 监听播放时间并保存进度：时间回调只更新内存里的最新值，每 10 秒落一次盘。
    // 两处都要锁死轮次（seq）与版本（owner）——原来每次时间回调都挂一个 10 秒延时，
    // 切走之后迟到的那几个会把这一版的位置写到那一版的键上
    playingOwner = owner
    later(() => {
        if (!ckplayerInstance || seq !== playerSeq) return
        ckplayerInstance.time((currentTime) => {
            if (seq === playerSeq) latestTime = currentTime
        })
    }, 1000)

    let lastSavedTime = -1
    every(() => {
        if (seq !== playerSeq || latestTime === lastSavedTime) return   // 暂停着就别反复写同一个值
        lastSavedTime = latestTime
        savePlayTime(owner.fileId, latestTime, owner)
    }, 10000)

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
    // 离开页面时把最后这一段补上，不然进度最多丢 10 秒（flush 是周期性的）
    if (playingOwner) savePlayTime(playingOwner.fileId, latestTime, playingOwner)
    destroyPlayer()   // 内含 clearPlayerTimers + pause/断源，离开页面同样要拆干净，否则音频在后台继续放
})

// 换版本 = 换一个文件：播放器要整个重开，进度也各记各的（v11）
watch(activeFileId, () => { nextTick(initCkplayer) })

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
            versions.value = video.value.versions || []
            // 停在影片口径那一版：进详情页看到的分辨率/大小就该与列表卡片一致。
            // 但刚改过/刚选过某一版时别把人弹回默认版——loadVideo 会在每次保存后被调用，
            // 跳回默认会让人以为自己的编辑没生效
            const keep = versions.value.find((v) => v.id === activeFileId.value)
            activeFileId.value = (keep || versions.value.find((v) => v.isDefault) || versions.value[0] || {}).id || ''
            delete video.value.versions
            actors.value = res.data.actors || []
            likeCount.value = res.data.likeCount || 0
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
    const fileId = shown.value.id
    if (!fileId) return
    resetting.value = true
    try {
        const res = await videoApi.resetFileSize(fileId)
        if (res.success) {
            // 后端把这一版重置后的整份字段带回来（含被清空的分辨率与两维），照单覆盖那一版；
            // 封面是影片层的，接口找回了封面时会一并带回来
            if (res.data) {
                const i = versions.value.findIndex((v) => v.id === fileId)
                if (i >= 0) versions.value[i] = { ...versions.value[i], ...res.data }
                if (res.data.coverFound) video.value.coverPath = res.data.coverFound
            }
            ui.success(res.message || '已重置')
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
    const v = shown.value
    if (!v.id) return
    const go = await ui.confirm({
        title: '删除视频文件',
        message: `确定要删掉「${v.displayName || '这一版'}」的文件吗？版本记录会留着（显示成还没上传），`
            + '封面与别的版本都不动。',
        danger: true
    })
    if (!go) return
    deletingFile.value = true
    try {
        const res = await videoApi.deleteVideoFile(v.id)
        if (res.success) {
            await loadVideo()
            ui.success(res.message || '已删除文件')
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
        const res = await videoApi.update(video.value.id, formData)
        // 业务失败是 200 + success:false，不判就会"没存上还说已保存"；失败时留在弹窗里好改
        if (!res?.success) return ui.error(res?.message || '保存失败')
        showEditDialog.value = false
        editingVideo.value = null
        await loadVideo()
        ui.success(res.message || '已保存')
        // 改了番号就会带着这一部片的版本文件改名；跟随了多少、有多少没跟随，都得当场说清，
        // 不然"手起的名字被悄悄改掉"和"以为改了其实没改"都发现不了
        const ri = res.renameInfo
        if (ri?.versionRenamed || ri?.versionSkipped) {
          const bits = []
          if (ri.versionRenamed) bits.push(`${ri.versionRenamed} 个版本文件已跟随改名`)
          if (ri.versionSkipped) bits.push(`${ri.versionSkipped} 个未跟随（行级番号不合规或文件不在）`)
          if (ri.coverRenamed) bits.push('封面已改名')
          ui.info(bits.join('；'))
        }
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
        // 点赞落在"正在看的这一版"上（v11）；卡片上的总数仍是这部片的求和
        const res = await videoApi.like(video.value.id, shown.value.id)
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

.actor-link {
    color: var(--info);
    cursor: pointer;
}

.actor-link:hover {
    text-decoration: underline;
}

/* ==================== 信息清单 ====================
   一行一项：标签列定宽，所以所有行落在同一条竖线上；标签一律不带冒号，
   字号统一 --f-sm，可点与否只靠 hover 区分 */
.kv-list {
    display: flex;
    flex-direction: column;
    gap: var(--s2);
}

.kv {
    display: grid;
    grid-template-columns: 5em minmax(0, 1fr);
    gap: var(--s2);
    align-items: baseline;
    font-size: var(--f-sm);
}

.kv__k {
    color: var(--text-faint);
    white-space: nowrap;
}

.kv__v {
    display: flex;
    align-items: center;
    gap: var(--s1);
    flex-wrap: wrap;
    min-width: 0;
    color: var(--text-dim);
    overflow-wrap: anywhere;
}

/* 片源标记 */
.media-option {
    border-color: var(--border);
    color: var(--text-dim);
    cursor: pointer;
}

.media-unknown {
    color: var(--text-faint);
    font-size: var(--f-xs);
}

/* 发行时年龄：跟在姓名后面的次要文本，不抢演员链接的视觉重心 */
.actor-age {
    font-style: normal;
    font-size: var(--f-xs);
    color: var(--text-faint);
}

.actor-age::before {
    content: ' · ';
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
