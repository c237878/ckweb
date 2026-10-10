<template>
  <div class="scan-dirs">
    <div class="panel-head">
      <div class="panel-head__text">
        <h3 class="sub-title">摄入扫描目录</h3>
        <p class="hint">导入影片、封面、字幕时从哪里找文件。这里只管"去哪儿找"，不在这儿改文件。</p>
      </div>
      <button class="btn btn--sm" @click="openAdd">添加</button>
    </div>

    <div v-if="loading" class="rows" aria-busy="true">
      <div v-for="n in 3" :key="n" class="skeleton row-skeleton"></div>
    </div>

    <ul v-else-if="list.length" class="rows">
      <li v-for="item in list" :key="item.id" class="row">
        <div class="row-main">
          <span class="row-title">{{ item.path }}</span>
          <div class="row-tags">
            <span v-if="item.category" class="tag tag--info">{{ item.category }}</span>
          </div>
        </div>
        <div class="row-actions">
          <button class="btn btn--sm" @click="openEdit(item)">编辑</button>
          <button class="btn btn--sm btn--danger" @click="remove(item)">删除</button>
        </div>
      </li>
    </ul>

    <div v-else class="empty">
      <p>暂无扫描目录</p>
      <button class="btn btn--sm" @click="openAdd">添加第一个目录</button>
    </div>

    <div v-if="showDialog" class="overlay" @click.self="close">
      <div class="dialog dialog--form" role="dialog" aria-modal="true" aria-labelledby="scan-dialog-title">
        <div class="dialog__head">
          <h3 class="dialog__title" id="scan-dialog-title">{{ editing ? '编辑文件目录' : '添加文件目录' }}</h3>
          <button class="dialog__close" aria-label="关闭" @click="close">&times;</button>
        </div>

        <div class="dialog__body">
          <p v-if="formError" class="notice notice--error" role="alert">{{ formError }}</p>

          <div class="field">
            <label for="scan-dir-category">目录分类 *</label>
            <input
              id="scan-dir-category"
              v-model="form.category"
              class="input"
              list="scan-dir-category-options"
              autocomplete="off"
              placeholder="选择或输入分类"
            />
            <datalist id="scan-dir-category-options">
              <option v-for="c in CATEGORY_OPTIONS" :key="c" :value="c"></option>
            </datalist>
            <span class="hint">扫描结果按分类归入对应板块，可直接输入新分类</span>
          </div>

          <div class="field">
            <label for="scan-dir-path">目录路径 *</label>
            <input id="scan-dir-path" v-model="form.path" class="input" placeholder="如: /Volumes/av" />
          </div>
        </div>

        <div class="dialog__foot">
          <button class="btn" @click="close">取消</button>
          <button class="btn btn--primary" :disabled="saving" @click="save">
            <span v-if="saving" class="spinner"></span>
            {{ saving ? '保存中...' : '保存' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import api, { scanDirectoryApi } from '@/scripts/api'
import { useUiStore, errText } from '@/scripts/store/ui'

const ui = useUiStore()

// 分类只给这三个常用档，但输入框允许自填（后端不锁枚举，板块是按分类名动态出来的）
const CATEGORY_OPTIONS = ['视频', '封面', '字幕']

const list = ref([])
const loading = ref(true)
const showDialog = ref(false)
const editing = ref(null)
const form = ref({ path: '', category: '' })
const formError = ref('')
const saving = ref(false)

const load = async () => {
  loading.value = true
  try {
    const res = await scanDirectoryApi.getList()
    if (res.success) list.value = res.data || []
  } catch (err) {
    console.error('获取文件目录失败:', err)
    ui.error('获取文件目录失败：' + errText(err))
  } finally {
    loading.value = false
  }
}

const openAdd = () => {
  editing.value = null
  form.value = { path: '', category: '' }
  formError.value = ''
  showDialog.value = true
}

const openEdit = (item) => {
  editing.value = item
  form.value = { path: item.path || '', category: item.category || '' }
  formError.value = ''
  showDialog.value = true
}

const close = () => {
  showDialog.value = false
  formError.value = ''
}

/** 校验接口没有收进 scanDirectoryApi，走同一个 axios 实例，路径与请求体保持不变 */
const checkDirExists = async (path) => {
  const res = await api.post('/scandirectory/check', { path })
  return !!(res?.success && res.exists)
}

const save = async () => {
  if (saving.value) return
  formError.value = ''
  if (!form.value.path) {
    formError.value = '目录路径不能为空'
    return
  }

  saving.value = true
  try {
    let exists
    try {
      exists = await checkDirExists(form.value.path)
    } catch (err) {
      console.error('校验目录失败:', err)
      formError.value = '目录校验请求失败，请确认后端服务可用'
      return
    }
    // 收一个不存在的目录进来，表现是"扫描永远扫不到东西"，所以当场拦住
    if (!exists) {
      formError.value = '目录路径不存在，请检查后重试'
      return
    }

    const payload = { path: form.value.path, category: form.value.category }
    const res = editing.value
      ? await scanDirectoryApi.update(editing.value.id, payload)
      : await scanDirectoryApi.add(payload)

    if (res.success) {
      showDialog.value = false
      ui.success(editing.value ? '目录已更新' : '目录已添加')
      await load()
    } else {
      formError.value = res.message || '保存失败'
    }
  } catch (err) {
    console.error('保存文件目录失败:', err)
    formError.value = '保存失败: ' + (err.message || err)
  } finally {
    saving.value = false
  }
}

const remove = async (item) => {
  const go = await ui.confirm({
    title: '确认删除',
    message: `确定删除文件目录 "${item.path}" 吗？`,
    danger: true
  })
  if (!go) return
  try {
    const res = await scanDirectoryApi.delete(item.id)
    if (res.success) {
      ui.success('目录已删除')
      await load()
    } else {
      ui.error(res.message || '删除失败')
    }
  } catch (err) {
    console.error('删除文件目录失败:', err)
    ui.error('删除失败：' + errText(err))
  }
}

onMounted(load)
</script>

<style scoped>
.scan-dirs {
  display: flex;
  flex-direction: column;
  gap: var(--s2);
}

.sub-title {
  margin: 0;
  font-size: var(--f-md);
  font-weight: 600;
}
</style>
