<template>
  <Dialog
    :visible="visible"
    :title="isEdit ? '编辑演员' : '添加演员'"
    size="sm"
    @confirm="handleSave"
    @cancel="handleCancel"
  >
    <template #content>
      <div class="form">
        <div class="field">
          <label for="aa-name">姓名 <span class="req">*</span></label>
          <input
            id="aa-name"
            v-model="form.name"
            class="input"
            type="text"
            placeholder="演员姓名"
            maxlength="50"
          />
        </div>

        <div class="field">
          <span class="field__label">曾用名</span>
          <ChipListEditor
            v-model="form.aliases"
            label="新增曾用名"
            placeholder="如：松岡すず"
            empty-text="还没有曾用名"
            hint="一行一个，检索影片时输入这些名字也能找到本人"
          />
        </div>

        <!-- 地区：既能在已有值里搜，也能手填一个新值 -->
        <!-- 可选值来自系统设置的规范列表，这里只做选择；要新增取值去 设置 → 数据源 -->
        <label class="field">
          <span class="field__label">地区</span>
          <SelectList v-model="form.country" :options="countryOptions" all-label="（无地区）" label="选择地区" />
        </label>

        <div class="field">
          <span class="field__label">外部链接</span>
          <div v-if="form.links.length" class="link-rows">
            <div v-for="(row, i) in form.links" :key="i" class="link-row">
              <SelectList
                v-model="row.kind"
                :options="LINK_KIND_OPTIONS"
                all-label="自动归类"
                class="link-row__kind"
                label="链接类型"
              />
              <input
                v-model.trim="row.url"
                class="input"
                type="text"
                maxlength="300"
                placeholder="https://example.com/…"
                :aria-label="`第 ${i + 1} 条链接地址`"
              />
              <button
                type="button"
                class="btn btn--sm btn--ghost"
                :aria-label="`移除第 ${i + 1} 条链接`"
                @click="removeLink(i)"
              >
&times;
</button>
            </div>
          </div>
          <button
            type="button"
            class="btn btn--sm link-add"
            :disabled="form.links.length >= MAX_LINKS"
            @click="addLink"
          >
            添加链接
          </button>
          <span class="hint">只支持 http/https，最多 {{ MAX_LINKS }} 条；类型不选会按域名自动归类</span>
        </div>

        <div class="field">
          <label for="aa-bio">简介</label>
          <textarea
            id="aa-bio"
            v-model="form.bio"
            class="textarea"
            rows="4"
            placeholder="简介（选填）"
          ></textarea>
        </div>
      </div>
    </template>

    <template #extra-actions>
      <button
        v-if="isEdit"
        type="button"
        class="btn btn--danger btn--sm foot-left"
        @click="handleDelete"
      >
        删除
      </button>
    </template>
  </Dialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { actorApi } from '@/scripts/api'
import { useUiStore } from '@/scripts/store/ui'
import Dialog from './Dialog.vue'
import SelectList from './SelectList.vue'
import ChipListEditor from './ChipListEditor.vue'
import { toOptions } from '@/scripts/utils/options'
import { LINK_KIND_OPTIONS } from '@/scripts/constants'

const MAX_LINKS = 10

const props = defineProps({
  visible: Boolean,
  editingActor: Object
})

const emit = defineEmits(['save', 'cancel', 'delete'])

const ui = useUiStore()

const countries = ref([])

const form = ref({
  id: '',
  name: '',
  aliases: [],
  links: [],
  country: '',
  bio: ''
})

const blankForm = () => ({ id: '', name: '', aliases: [], links: [], country: '', bio: '' })

const addLink = () => {
  // 空串是"自动归类"：新行一律留空，让后端按域名判型，判不到才算 other
  form.value.links.push({ kind: '', url: '' })
}

const removeLink = (index) => {
  form.value.links.splice(index, 1)
}

const isEdit = computed(() => !!props.editingActor)

// 国家是字符串字段，直接拿值本身当选项 id
const countryOptions = computed(() => toOptions(countries.value, form.value.country))

// 专用去重接口：列表接口已把 pageSize 钳到 500，靠翻列表取地区会静默截断
const loadCountries = async () => {
  try {
    const res = await actorApi.getCountries()
    countries.value = res.success && Array.isArray(res.data) ? res.data : []
  } catch (e) {
    console.error('加载地区列表失败', e)
  }
}

watch(() => props.visible, (val) => {
  if (!val) return
  loadCountries()
  const source = props.editingActor
  // 编辑对话框从不在详情态打开，所以列表行里的 aliases 数组就是唯一来源
  form.value = source
    ? {
        id: source.id || '',
        name: source.name || '',
        aliases: Array.isArray(source.aliases) ? [...source.aliases] : [],
        links: Array.isArray(source.links) ? source.links.map((l) => ({ ...l })) : [],
        country: source.country || '',
        bio: source.bio || ''
      }
    : blankForm()
})

const handleSave = () => {
  if (!form.value.name.trim()) {
    ui.warn('请输入演员姓名')
    return
  }
  // 空地址行不发出去：后端会丢，但没必要把半成品当成一次有效提交
  const { links, ...rest } = form.value
  emit('save', { ...rest, links: links.filter((l) => l.url) })
}

const handleCancel = () => {
  emit('cancel')
}

// 删除确认由父页面统一处理（ActorList / ActorDetail 各自 await ui.confirm），
// 这里再问一次会出现两个一模一样的对话框，跟 AddVideoDialog 的做法保持一致
const handleDelete = () => {
  emit('delete', props.editingActor.id)
}
</script>

<style scoped>
.form {
  display: flex;
  flex-direction: column;
  gap: var(--s4);
}

.req {
  color: var(--danger);
}

.link-rows {
  display: flex;
  flex-direction: column;
  gap: var(--s2);
}

.link-row {
  display: flex;
  align-items: center;
  gap: var(--s2);
}

.link-row .input {
  flex: 1;
  min-width: 0;
}

/* 类型列定宽，地址列吃剩余空间 */
.link-row__kind {
  flex-shrink: 0;
}

.link-add {
  align-self: flex-start;
}

.switch {
  align-self: flex-start;
  font-size: var(--f-xs);
  color: var(--accent);
}

.switch:hover {
  text-decoration: underline;
}

.foot-left {
  margin-right: auto;
}
</style>
