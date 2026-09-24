<template>
  <Dialog
    :visible="visible"
    title="疑似重复演员"
    size="wide"
    confirm-text="完成"
    :close-on-backdrop="false"
    @confirm="emit('cancel')"
    @cancel="emit('cancel')"
  >
    <template #content>
      <p class="notice">
        候选来自两条线索：一人本名恰好是对方的曾用名（强），或两人共享某个曾用名（弱）。
        <strong>共享曾用名不等于同一人</strong>，也可能是第三个女优的名字被同时挂到两人名下 —— 合不合由你判断。
        合并不是可撤销操作（动手前会自动做一次数据库快照）。
      </p>

      <div v-if="loading" class="loading-block">
        <div v-for="n in 4" :key="n" class="skeleton row-skeleton"></div>
      </div>

      <div v-else-if="error" class="notice notice--error">
        {{ error }}
        <button class="btn btn--sm" @click="load">重试</button>
      </div>

      <div v-else-if="!pairs.length" class="empty">
        <p>没有发现共享曾用名的候选</p>
      </div>

      <div v-else class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>线索</th>
              <th>演员 A</th>
              <th>演员 B</th>
              <th class="col-act">保留谁</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="pair in pairs" :key="`${pair.id1}-${pair.id2}`">
              <td class="col-clue">
                <span class="tag" :class="pair.strong ? 'tag--success' : ''">{{ pair.strong ? '本名互指' : '共享曾用名' }}</span>
                <span class="clue-list">{{ pair.sharedAliases.join('、') }}</span>
              </td>
              <td>
                <router-link class="side-name" :to="`/actor/${pair.id1}`" target="_blank">{{ pair.name1 }}</router-link>
                <span class="side-meta">{{ pair.videoCount1 }} 部{{ pair.country1 ? ` · ${pair.country1}` : '' }}</span>
              </td>
              <td>
                <router-link class="side-name" :to="`/actor/${pair.id2}`" target="_blank">{{ pair.name2 }}</router-link>
                <span class="side-meta">{{ pair.videoCount2 }} 部{{ pair.country2 ? ` · ${pair.country2}` : '' }}</span>
              </td>
              <td class="col-act">
                <button class="btn btn--sm" :disabled="busy" @click="askMerge(pair, 'to1')">留 A 并 B</button>
                <button class="btn btn--sm" :disabled="busy" @click="askMerge(pair, 'to2')">留 B 并 A</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </Dialog>
</template>

<script setup>
import { ref, watch } from 'vue'
import { actorApi } from '@/scripts/api'
import { useUiStore, errText } from '@/scripts/store/ui'
import Dialog from './Dialog.vue'

/**
 * 重复演员复核表：一行一组候选，两个按钮决定"留谁"。
 *
 * 合并方向必须让人当场选，因为留下来的是哪个艺名会直接影响以后能不能搜得到人。
 * 这里不做"忽略此组"：误报的线索（第三个女优的名字被同时挂到两人名下）会一直留在列表里，
 * 但一组只有两个按钮，留着它不会误伤，等哪天数据修对了自然消失。
 */
const props = defineProps({
  visible: Boolean
})

const emit = defineEmits(['cancel', 'merged'])

const ui = useUiStore()

const pairs = ref([])
const loading = ref(false)
const error = ref('')
const busy = ref(false)

const load = async () => {
  loading.value = true
  error.value = ''
  try {
    const res = await actorApi.duplicates()
    if (res.success) pairs.value = res.data || []
    else error.value = res.message || '候选加载失败'
  } catch (err) {
    console.error('加载疑似重复演员失败:', err)
    error.value = '候选加载失败，请确认后端服务可用'
  } finally {
    loading.value = false
  }
}

// 每次打开都重取：合并一组之后，剩下的候选关系就变了
watch(() => props.visible, (val) => { if (val) load() })

const askMerge = async (pair, keep) => {
  const to = keep === 'to1' ? pair.id1 : pair.id2
  const from = keep === 'to1' ? pair.id2 : pair.id1
  const toName = keep === 'to1' ? pair.name1 : pair.name2
  const fromName = keep === 'to1' ? pair.name2 : pair.name1
  const go = await ui.confirm({
    title: `把「${fromName}」并入「${toName}」`,
    message: `「${fromName}」的影片会改挂到「${toName}」名下，她的曾用名与外链一并过去，`
      + `「${fromName}」这个名字会作为曾用名保留，然后该演员被删除。此操作不能在界面里撤销。`,
    danger: true
  })
  if (!go) return

  busy.value = true
  try {
    const res = await actorApi.mergeActors(from, to)
    if (!res.success) {
      ui.error(res.message || '合并失败')
      return
    }
    ui.success(res.message || '已合并')
    emit('merged')
    await load()
  } catch (err) {
    console.error('合并演员失败:', err)
    ui.error('合并失败：' + errText(err))
  } finally {
    busy.value = false
  }
}
</script>

<style scoped>
.loading-block {
  display: flex;
  flex-direction: column;
  gap: var(--s2);
}

.row-skeleton {
  height: 56px;
  border-radius: var(--r1);
}

.clue-list {
  display: block;
  color: var(--text-faint);
  font-size: var(--f-xs);
  word-break: break-all;
}

.side-name {
  color: var(--text);
}

.side-name:hover {
  color: var(--accent);
}

.side-meta {
  display: block;
  color: var(--text-faint);
  font-size: var(--f-xs);
  font-variant-numeric: tabular-nums;
}

.col-clue {
  width: 34%;
}

/* 两个方向按钮并排，窄屏下允许换行而不是挤压列宽 */
.col-act {
  width: 168px;
  white-space: normal;
}

.col-act .btn + .btn {
  margin-left: var(--s1);
}
</style>
