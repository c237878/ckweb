<template>
  <Dialog
    :visible="visible"
    :title="`从出演影片封面截头像${name ? '：' + name : ''}`"
    size="lg"
    @cancel="close"
  >
    <!-- 自定义底部按钮：Dialog 内置契约是"点确认即关闭"，这里要等后端截完才知道能不能关 -->
    <template #actions>
      <button type="button" class="btn" @click="close">取消</button>
      <button type="button" class="btn btn--primary" :disabled="!picked || saving" @click="save">
        {{ saving ? '截图中…' : '截并设为头像' }}
      </button>
    </template>

    <template #content>
      <div class="crop">
        <!-- 预览就是落盘结果：方框里 img 用 object-fit: cover + object-position，
             和后端裁切的算式同一个（偏移 = (原图边长 - 裁框边长) × 比例），
             所以滑块拖到哪，存下来的正方形就是哪一块 -->
        <div class="crop__frame">
          <img
            v-if="picked"
            :src="coverUrl(picked)"
            :style="previewStyle"
            alt="封面裁切预览"
            @load="onCoverLoad"
          />
          <span v-else class="crop__waiting">{{ loading ? '正在取她的片子…' : '先在右边挑一部片的封面' }}</span>
        </div>

        <div class="crop__side">
          <p v-if="error" class="notice notice--error">{{ error }}</p>

          <div v-if="!films.length && !loading && !error" class="empty">
            <p>她名下没有带封面的影片，这条路走不通</p>
          </div>

          <div v-if="films.length" class="picker" :aria-busy="loading">
            <div class="picker__grid">
              <button
                v-for="f in films"
                :key="f.id"
                type="button"
                class="picker__cell"
                :class="{ 'is-picked': picked?.id === f.id }"
                :title="f.name || f.code"
                @click="picked = f"
              >
                <img :src="coverUrl(f, 's')" :alt="`${f.code} 封面`" loading="lazy" decoding="async" />
                <span class="picker__code">{{ f.code }}</span>
              </button>
            </div>
          </div>

          <div v-if="picked" class="sliders">
            <label class="slider">
              <span class="slider__k">缩放</span>
              <input v-model.number="zoomPct" type="range" min="15" max="100" step="1" />
            </label>
            <label class="slider">
              <span class="slider__k">左右</span>
              <input v-model.number="xPct" type="range" min="0" max="100" step="1" />
            </label>
            <label class="slider">
              <span class="slider__k">上下</span>
              <input v-model.number="yPct" type="range" min="0" max="100" step="1" />
            </label>
            <p class="crop__meta">{{ cropMeta }}</p>
          </div>
        </div>
      </div>
    </template>
  </Dialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import Dialog from '@/views/components/Dialog.vue'
import { actorApi, videoApi } from '@/scripts/api'
import { errText } from '@/scripts/store/ui'

const props = defineProps({
  visible: { type: Boolean, default: false },
  actorId: { type: String, default: '' },
  name: { type: String, default: '' }
})
const emit = defineEmits(['saved', 'cancel'])

const films = ref([])
const picked = ref(null)
const loading = ref(false)
const saving = ref(false)
const error = ref('')

// 默认往上偏 18%：竖版海报的脸通常在上三分之一，这也是列表页 --avatar-focus 用的那个位置
const xPct = ref(50)
const yPct = ref(18)
// 缩放：裁框边长占原图短边的比例。封面很大，只挪位置永远截不出"脸占满圆框"
const zoomPct = ref(100)
// 原图尺寸：预览换算要用，来自封面加载完的 naturalWidth/Height
const nat = ref({ w: 0, h: 0 })

// 选择格用缩略图就够；预览那张必须是原图——裁切框是按原图尺寸算的，
// 拿缩放过的图当预览会对不上落盘结果
const coverUrl = (film, size = '') => videoApi.getCoverUrl(film.id, size)

const onCoverLoad = (e) => {
  nat.value = { w: e.target.naturalWidth, h: e.target.naturalHeight }
}

// 与后端同一条算式：side = 短边 × 缩放，偏移 = (原图该轴 - side) × 比例
const crop = computed(() => {
  const { w, h } = nat.value
  if (!w || !h) return null
  const side = Math.max(48, Math.round(Math.min(w, h) * (zoomPct.value / 100)))
  return {
    side,
    ox: Math.round((w - side) * (xPct.value / 100)),
    oy: Math.round((h - side) * (yPct.value / 100))
  }
})

/**
 * 预览的换算：方框边长当 100%，图按 side→框 的比例放大，再按裁框原点往负方向挪。
 * object-fit: cover 表达不了"截更小的一块"，所以这里改成绝对定位 + 百分比尺寸
 * （框是正方形，宽高的百分比基准相同，缩放和位移就都在同一个比例上）。
 */
const previewStyle = computed(() => {
  const c = crop.value
  const { w, h } = nat.value
  if (!c || !w) return {}
  return {
    width: `${(w / c.side) * 100}%`,
    height: `${(h / c.side) * 100}%`,
    left: `${-(c.ox / c.side) * 100}%`,
    top: `${-(c.oy / c.side) * 100}%`
  }
})

const cropMeta = computed(() => {
  const c = crop.value
  if (!c) return '封面尺寸读取中…'
  return `截 ${c.side}×${c.side}，位置 ${c.ox}, ${c.oy}`
})

// 一次拉全她的片子（几百部量级），带封面的才进选择器——没有封面文件就没什么可截
const loadFilms = async () => {
  loading.value = true
  error.value = ''
  try {
    const res = await actorApi.getVideos(props.actorId, { page: 1, pageSize: 500 })
    if (!res?.success) {
      error.value = res?.message || '取她的片子失败'
      return
    }
    films.value = (res.data || []).filter((v) => v.coverPath)
    picked.value = films.value[0] || null
  } catch (err) {
    console.error('加载演员影片失败:', err)
    error.value = errText(err, '取她的片子失败')
  } finally {
    loading.value = false
  }
}

// 每次打开都重取：她刚补的封面不该要人刷新页面才看得见
watch(() => props.visible, (v) => {
  if (!v) return
  xPct.value = 50
  yPct.value = 18
  zoomPct.value = 100
  nat.value = { w: 0, h: 0 }
  loadFilms()
})

const close = () => emit('cancel')

const save = async () => {
  if (!picked.value || saving.value) return
  saving.value = true
  try {
    const res = await actorApi.avatarFromCover(props.actorId, {
      videoId: picked.value.id,
      x: xPct.value / 100,
      y: yPct.value / 100,
      zoom: zoomPct.value / 100
    })
    if (!res?.success) {
      // 失败留在弹窗里：原因会指出是封面文件没了还是格式读不出来，关掉就得重挑
      error.value = res?.message || '截取失败'
      return
    }
    emit('saved', res)
  } catch (err) {
    console.error('从封面截头像失败:', err)
    error.value = errText(err, '截取失败')
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.crop {
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr);
  gap: var(--s4);
  align-items: start;
}

/* 正方形预览框：圆角按头像框（列表页是圆形）预览，看得到最终形状 */
.crop__frame {
  position: relative;
  width: 260px;
  aspect-ratio: 1;
  border-radius: var(--r2);
  overflow: hidden;
  background: var(--bg-soft, #000);
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 绝对定位 + 百分比尺寸/位移：见 previewStyle 的换算，框是正方形所以两个基准同一个值 */
.crop__frame img {
  position: absolute;
  max-width: none;
  display: block;
}

.crop__meta {
  margin: 0;
  color: var(--text-dim);
  font-size: var(--f-xs);
  font-variant-numeric: tabular-nums;
}

.crop__waiting {
  color: var(--text-dim);
  font-size: var(--f-sm);
  padding: var(--s3);
  text-align: center;
}

.crop__side {
  display: flex;
  flex-direction: column;
  gap: var(--s3);
  min-width: 0;
}

/* 封面墙：一屏能扫过十几张，靠滚动而不是无限拉长弹窗 */
.picker {
  max-height: 320px;
  overflow-y: auto;
  border: 1px solid var(--border);
  border-radius: var(--r2);
  padding: var(--s2);
}

.picker__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(84px, 1fr));
  gap: var(--s2);
}

.picker__cell {
  position: relative;
  padding: 0;
  border: 2px solid transparent;
  border-radius: var(--r1);
  background: none;
  overflow: hidden;
  cursor: pointer;
}

.picker__cell img {
  width: 100%;
  aspect-ratio: var(--ratio-cover, 2 / 3);
  object-fit: cover;
  display: block;
}

.picker__cell.is-picked {
  border-color: var(--accent);
}

.picker__code {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 2px 4px;
  font-size: var(--f-xs);
  color: #fff;
  background: rgba(0, 0, 0, .6);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.sliders {
  display: flex;
  flex-direction: column;
  gap: var(--s2);
}

.slider {
  display: grid;
  grid-template-columns: 3em minmax(0, 1fr);
  gap: var(--s2);
  align-items: center;
  font-size: var(--f-sm);
}

.slider__k {
  color: var(--text-dim);
}

.slider input[type="range"] {
  width: 100%;
  accent-color: var(--accent);
}

/* 窄屏就上下排：预览框小一点，封面墙矮一点 */
@media (max-width: 699px) {
  .crop {
    grid-template-columns: minmax(0, 1fr);
  }

  .crop__frame {
    width: 100%;
    max-width: 260px;
    margin: 0 auto;
  }

  .picker {
    max-height: 220px;
  }
}
</style>
