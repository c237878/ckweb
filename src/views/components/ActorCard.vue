<template>
  <article
    class="card card--row card--clickable actor-card"
    :class="{ selected }"
    @click="handleClick"
  >
    <div class="card-main">
      <input
        v-if="selectable"
        type="checkbox"
        class="card-checkbox"
        :checked="selected"
        :aria-label="`选择 ${actor.name}`"
        @change="emit('select', actor)"
        @click.stop
      />
      <div class="card-body">
        <div class="card-title" :title="actor.name">{{ actor.name }}</div>
        <div class="pills">
          <span v-if="actor.likeCount > 0" class="tag tag--like">♥ {{ actor.likeCount }}</span>
          <span v-if="actor.videoCount > 0" class="tag">{{ actor.videoCount }} 部</span>
          <span v-if="actor.country" class="tag tag--accent">{{ actor.country }}</span>
          <span
            v-if="actor.unloadedCount > 0"
            class="tag tag--danger"
            :title="`有 ${actor.unloadedCount} 部未下载`"
          >未下载 {{ actor.unloadedCount }}</span>
        </div>
      </div>
    </div>
  </article>
</template>

<script setup>
import { useRouter } from 'vue-router'

const props = defineProps({
  actor: { type: Object, required: true },
  /** 点整张卡片做什么：browse 进详情 / select 勾选 / pick 选一个去编辑 */
  clickAction: { type: String, default: 'browse' },
  selectable: { type: Boolean, default: false },
  selected: { type: Boolean, default: false }
})

const emit = defineEmits(['select', 'pick'])
const router = useRouter()

const handleClick = () => {
  if (props.clickAction === 'select') emit('select', props.actor)
  else if (props.clickAction === 'pick') emit('pick', props.actor)
  else router.push(`/actor/${props.actor.id}`)
}
</script>
