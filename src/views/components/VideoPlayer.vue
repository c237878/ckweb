<template>
    <div class="video-player">
        <!-- 全站只有这一个 video 元素：换版本走 watch 里的换源，不新建节点。
             脱离文档的 video 在 Chrome 里仍可能继续出声，"扔掉旧元素再建一个"正是
             原来两版同播的成因，这里从结构上不给它机会 -->
        <video
            ref="el"
            class="video-player__el"
            :class="{ 'video-player__el--swapped': swapped }"
            :style="rotationStyle"
            controls
            playsinline
            :preload="startAt > 0 ? 'metadata' : 'none'"
            :poster="poster || undefined"
            @loadedmetadata="onMetadata"
            @timeupdate="onTimeUpdate"
            @ended="onEnded"
            @error="onError"
        >
            <track
                v-if="subtitleUrl"
                :key="subtitleUrl"
                kind="subtitles"
                :src="subtitleUrl"
                srclang="zh"
                label="字幕"
                default
            />
        </video>
        <div v-if="errorText" class="video-player__error">{{ errorText }}</div>
    </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps({
    /** 取流地址；空串表示这一版还没有文件，只显示封面 */
    src: { type: String, default: '' },
    poster: { type: String, default: '' },
    /** 续播位置（秒）；这一版的进度，不是影片的。
     *  为 0 时 preload 走 none：不预读数据，画面就停在封面上，不会显示第 0 帧
     *  （拖回开头 = 不续播，他要看到封面而不是某一帧的截图） */
    startAt: { type: Number, default: 0 },
    subtitleUrl: { type: String, default: '' },
    volume: { type: Number, default: 1 },
    rate: { type: Number, default: 1 },
    /** 画面旋转角度，转的是 video 元素本身 */
    rotation: { type: Number, default: 0 }
})
const emit = defineEmits(['time', 'metadata', 'ended'])

const el = ref(null)
const errorText = ref('')

// 换源：先停下、断源、丢缓冲，再挂新地址。没地址时只留封面，不塞空 src（空 src 会触发 error）
const swapSource = () => {
    const v = el.value
    if (!v) return
    v.pause()
    errorText.value = ''
    if (props.src) {
        // 挂新地址本身就会走一遍资源选择算法，不要再 load()：
        // load() 会立刻开始拉流，把 preload="none" 的"从头看时只出封面、不占带宽"给抵消掉
        v.src = props.src
    } else {
        v.removeAttribute('src')
        v.load()
    }
}

const applyVolume = () => {
    const v = el.value
    if (v) v.volume = Math.max(0, Math.min(1, props.volume))
}
const applyRate = () => {
    const v = el.value
    if (v) v.playbackRate = props.rate || 1
}
/**
 * 旋转后的尺寸：元素盒要**横竖互换**，不能只是原地转。
 *
 * 外壳竖着（aspect-ratio 已换成倒数）时，video 元素是"高>宽"的一个盒子，
 * 原地 rotate(90deg) 会把它变成"宽>高"伸到外壳外面，被 overflow:hidden 切掉两头
 * ——这就是之前旋转后画面显示不全的成因。
 * 用容器查询单位把宽高互换（100cqh 当宽、100cqw 当高）正好补满外壳；
 * 再居中一次，因为绝对定位后原点是左上角。样式绑在模板上，不再手写 element.style。
 */
const swapped = computed(() => Math.abs(props.rotation) % 180 === 90)
const rotationStyle = computed(() => {
    const deg = props.rotation || 0
    if (!swapped.value) return { transform: deg ? `rotate(${deg}deg)` : '' }
    return { transform: `translate(-50%, -50%) rotate(${deg}deg)` }
})

const onMetadata = () => {
    const v = el.value
    if (!v) return
    applyVolume()
    applyRate()
    // 字幕默认开（和换播放器前的行为一致），要关用控制条上的字幕菜单
    for (const t of v.textTracks || []) {
        if (t.kind === 'subtitles') t.mode = 'showing'
    }
    // 续播：位置落在最后几秒内就当看完了，从头放，别让人对着一个静止的画面
    const nearEnd = Number.isFinite(v.duration) && props.startAt >= v.duration - 5
    if (props.startAt > 0 && !nearEnd) v.currentTime = props.startAt
    emit('metadata', { width: v.videoWidth, height: v.videoHeight, duration: v.duration })
}

const onTimeUpdate = () => {
    const v = el.value
    if (v) emit('time', v.currentTime)
}

const onEnded = () => {
    emit('ended')
}

const onError = () => {
    // 没有地址时浏览器不会报错（只是显示封面），所以走到这里就是"有地址却读不出来"
    if (props.src) errorText.value = '这一版读不出来：可能文件已移走、网络盘没挂载，或编码浏览器不支持'
}

// 首挂就要挂源：watcher 只在变化时跑，漏掉这一步会得到一个没有 src 的空元素
onMounted(swapSource)
// 只盯 src：字幕轨道是 video 的子元素，浏览器会自己增删 textTracks，
// 把 subtitleUrl 也当换源条件的话，字幕检查晚一步回来就会把刚定好的播放位置抹成 0
watch(() => props.src, swapSource)
watch(() => props.volume, applyVolume)
watch(() => props.rate, applyRate)

onBeforeUnmount(() => {
    // 离开页面时同样先停再断源，不然音频会跟着到别的页面
    const v = el.value
    if (!v) return
    v.pause()
    v.removeAttribute('src')
    v.load()
})

// 页面要干的事（截图、读真实分辨率）都作用在原生元素上，这里把元素交出去。
// 画中画不在其中：原生控制条的菜单里就有，页面不再自己摆一个按钮
const videoEl = () => el.value

// 截图：画当前帧到 canvas。取流同源，画布不会被污染；旋转不会被记录（和原来一致）
const screenshot = () => {
    const v = el.value
    if (!v || !v.videoWidth) return ''
    const canvas = document.createElement('canvas')
    canvas.width = v.videoWidth
    canvas.height = v.videoHeight
    const ctx = canvas.getContext('2d')
    ctx.drawImage(v, 0, 0, canvas.width, canvas.height)
    try {
        return canvas.toDataURL('image/jpeg', 0.9)
    } catch (e) {
        console.warn('截图失败:', e)
        return ''
    }
}

defineExpose({ videoEl, screenshot, play: () => el.value?.play(), pause: () => el.value?.pause() })
</script>

<style scoped>
.video-player {
    position: relative;
    width: 100%;
    height: 100%;
    background: #000;
    /* 让 cqh/cqw 有参照：旋转时要拿外壳的高当元素的宽 */
    container-type: size;
}

.video-player__el {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: contain;
    transform-origin: center center;
}

/* 横竖互换：外壳的高当宽、外壳的宽当高，转 90° 之后刚好铺满外壳，不再伸出去被切 */
.video-player__el--swapped {
    position: absolute;
    left: 50%;
    top: 50%;
    width: 100cqh;
    height: 100cqw;
}

.video-player__error {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    max-width: 80%;
    padding: 10px 22px;
    border-radius: var(--r2);
    background: rgba(0, 0, 0, .75);
    color: #fff;
    font-size: var(--f-lg);
    text-align: center;
    pointer-events: none;
    z-index: 20;
}
</style>
