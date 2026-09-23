<template>
  <article
    class="comic-card card card--link"
    :class="{ selected, picking: clickAction !== 'browse' }"
    @click="handleClick"
  >
    <div v-if="selectable" class="select-checkbox" @click.stop>
      <input
        type="checkbox"
        :checked="selected"
        :aria-label="`选择 ${comic.name}`"
        @change="emit('select', comic)"
      />
    </div>

    <div class="cover">
      <img
        v-if="comic.coverPath && !coverFailed"
        :src="coverUrl"
        :alt="`${comic.name || '漫画'} 封面`"
        loading="lazy"
        decoding="async"
        @error="coverFailed = true"
      />
      <!-- 封面缺失/挂掉时留首字占位，卡片高度不塌 -->
      <span v-else class="cover-fallback">{{ comic.name?.charAt(0) || '?' }}</span>

      <a
        v-if="comic.url"
        class="external-link"
        :href="comic.url"
        target="_blank"
        rel="noopener noreferrer"
        title="打开外部链接"
        aria-label="打开外部链接"
        @click.stop
      ><span aria-hidden="true">↗</span></a>
    </div>

    <div class="card-info">
      <h2 class="comic-name card-title" :title="comic.name">
        <span class="comic-name-text">{{ comic.name }}</span>
        <!-- 完结是状态，保留药丸 -->
        <span v-if="comic.status === 1" class="tag tag--danger">完结</span>
      </h2>
      <div class="comic-author" v-if="comic.author">{{ comic.author }}</div>
      <!-- 与影片卡片同一套：胶囊同行、放不下换行；不可点的自然没有 hover -->
      <div class="pills">
        <span class="tag pill">{{ comic.chapterCount }} 章</span>
        <span v-if="comic.likeCount > 0" class="tag tag--like pill">♥ {{ comic.likeCount }}</span>
      </div>
    </div>
  </article>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { comicApi } from '@/scripts/api'

const props = defineProps({
  comic: { type: Object, required: true },
  /** 点整张卡片做什么：browse 进详情 / select 勾选 / pick 选一个去编辑 */
  clickAction: { type: String, default: 'browse' },
  selectable: { type: Boolean, default: false },
  selected: { type: Boolean, default: false }
})

const emit = defineEmits(['select', 'pick'])
const router = useRouter()

const coverFailed = ref(false)

const coverUrl = computed(() => comicApi.getCoverUrl(props.comic.coverPath))

// 列表复用卡片时（换漫画对象但组件被复用），旧的加载失败状态不能留着
watch(() => props.comic.coverPath, () => { coverFailed.value = false })

const handleClick = () => {
  if (props.clickAction === 'select') emit('select', props.comic)
  else if (props.clickAction === 'pick') emit('pick', props.comic)
  else router.push(`/comic/${props.comic.id}`)
}
</script>

<style scoped>
/* 外观全部走 .card / .cover / .tag / .facts，这里只补卡片特有的排布 */
.comic-card {
  display: flex;
  flex-direction: column;
  position: relative;
  cursor: pointer;
}

.comic-card.picking {
  cursor: pointer;
}

.comic-card.selected {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--accent-soft), var(--shadow-2);
}

.select-checkbox {
  position: absolute;
  top: var(--s2);
  left: var(--s2);
  z-index: 2;
}

.select-checkbox input[type="checkbox"] {
  width: 18px;
  height: 18px;
  cursor: pointer;
  accent-color: var(--accent);
}

.card-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--s1);
  padding: var(--s3);
}

.comic-name {
  display: flex;
  align-items: center;
  gap: var(--s1);
}

.comic-name-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.comic-author {
  font-size: var(--f-sm);
  color: var(--text-dim);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pills {
  margin-top: auto;   /* 卡片等高时把胶囊压到底部 */
}

/* 外链角标：只在需要时才出现，键盘聚焦同样要能看到 */
.external-link {
  position: absolute;
  top: var(--s2);
  right: var(--s2);
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border-radius: var(--r1);
  background: rgba(8, 10, 14, .62);
  color: #fff;
  font-size: var(--f-lg);
  line-height: 1;
  opacity: 0;
  transition: opacity var(--dur) var(--ease), background var(--dur) var(--ease);
}

.comic-card:hover .external-link,
.external-link:focus-visible {
  opacity: 1;
}

.external-link:hover {
  background: rgba(8, 10, 14, .82);
}
</style>
