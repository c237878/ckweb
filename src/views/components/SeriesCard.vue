<template>
  <article
    class="card card--row card--clickable series-card"
    :class="{ selected }"
    @click="handleClick"
  >
    <div class="card-main">
      <input
        v-if="selectable"
        type="checkbox"
        class="card-checkbox"
        :checked="selected"
        :aria-label="`选择 ${series.name}`"
        @change="emit('select', series)"
        @click.stop
      />
      <div class="card-body">
        <div class="card-title" :title="series.name">{{ series.name }}</div>
        <div v-if="series.alias" class="alias" :title="series.alias">{{ series.alias }}</div>
        <div class="pills">
          <span v-if="series.likeCount > 0" class="tag tag--like">♥ {{ series.likeCount }}</span>
          <span v-if="series.videoCount > 0" class="tag">{{ series.videoCount }} 部</span>
          <span v-if="series.country" class="tag tag--accent">{{ series.country }}</span>
          <span
            v-if="series.unloadedCount > 0"
            class="tag tag--danger"
            :title="`有 ${series.unloadedCount} 部未下载`"
          >未下载 {{ series.unloadedCount }}</span>
        </div>
      </div>
    </div>
  </article>
</template>

<script setup>
import { useRouter } from 'vue-router'

const props = defineProps({
  series: { type: Object, required: true },
  /** 点整张卡片做什么：browse 进详情 / select 勾选 / pick 选一个去编辑 */
  clickAction: { type: String, default: 'browse' },
  selectable: { type: Boolean, default: false },
  selected: { type: Boolean, default: false }
})

const emit = defineEmits(['select', 'pick'])
const router = useRouter()

const handleClick = () => {
  if (props.clickAction === 'select') emit('select', props.series)
  else if (props.clickAction === 'pick') emit('pick', props.series)
  else router.push(`/series/${props.series.id}`)
}
</script>

<style scoped>
.alias {
  font-size: var(--f-sm);
  color: var(--text-dim);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
