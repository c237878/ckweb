<template>
  <div class="page settings">
    <div class="page-header">
      <h1 class="page-title">系统设置</h1>
    </div>

    <!-- 写操作结果：固定停留、可被读屏播报，不再 3 秒自动消失 -->
    <p v-if="feedback.text" class="notice feedback" :class="feedback.type === 'error' ? 'notice--error' : 'notice--success'" role="status">
      <span>{{ feedback.text }}</span>
      <button class="btn btn--sm btn--ghost" @click="feedback.text = ''">知道了</button>
    </p>

    <!-- 读取失败：整页只保留一条，带重试 -->
    <p v-if="loadError" class="notice notice--error" role="alert">
      <span>{{ loadError }}</span>
      <button class="btn btn--sm" @click="loadAll">重试</button>
    </p>

    <!-- 基本信息 -->
    <section class="panel">
      <h2 class="section-title">基本信息</h2>

      <div v-if="loadingSettings" class="settings-grid" aria-busy="true">
        <div v-for="n in settingsList.length" :key="n" class="skeleton field-skeleton"></div>
      </div>

      <div v-else class="settings-grid">
        <div v-for="item in settingsList" :key="item.id" class="field">
          <label :for="'setting-' + item.id">{{ item.label }}</label>
          <input
            :id="'setting-' + item.id"
            v-model="item.value"
            class="input"
            :type="item.type || 'text'"
            :min="item.min"
            :max="item.max"
            :placeholder="item.placeholder"
          />
          <span v-if="item.hint" class="hint">{{ item.hint }}</span>
        </div>
      </div>

      <div class="panel-foot">
        <span class="hint">
          本页共 {{ settingsList.length }} 项设置，点击保存后一次提交（每项一个请求，期间请勿关闭页面）
        </span>
        <button class="btn btn--primary" :disabled="savingBasic || loadingSettings" @click="saveBasicSettings">
          <span v-if="savingBasic" class="spinner"></span>
          {{ savingBasic ? '保存中...' : '保存基本信息' }}
        </button>
      </div>
    </section>

    <!-- 文件目录管理 -->
    <section class="panel">
      <div class="panel-head">
        <h2 class="section-title">文件目录</h2>
        <button class="btn btn--sm btn--primary" @click="openAddScanDirDialog">添加目录</button>
      </div>

      <div v-if="loadingScanDirs" class="rows" aria-busy="true">
        <div v-for="n in 3" :key="n" class="skeleton row-skeleton"></div>
      </div>

      <ul v-else-if="scanDirList.length" class="rows">
        <li v-for="item in scanDirList" :key="item.id" class="row">
          <div class="row-main">
            <span class="row-title">{{ item.path }}</span>
            <div class="row-tags">
              <span v-if="item.category" class="tag tag--info">{{ item.category }}</span>
            </div>
          </div>
          <div class="row-actions">
            <button class="btn btn--sm" @click="openEditScanDirDialog(item)">编辑</button>
            <button class="btn btn--sm btn--danger" @click="deleteScanDir(item)">删除</button>
          </div>
        </li>
      </ul>

      <div v-else class="empty">
        <p>暂无扫描目录</p>
        <button class="btn btn--sm" @click="openAddScanDirDialog">添加第一个目录</button>
      </div>
    </section>

    <!-- 文件目录弹窗 -->
    <div v-if="showScanDirDialog" class="overlay" @click.self="closeScanDirDialog">
      <div class="dialog dialog--form" role="dialog" aria-modal="true" aria-labelledby="scan-dialog-title">
        <div class="dialog__head">
          <h3 class="dialog__title" id="scan-dialog-title">
            {{ editingScanDir ? '编辑文件目录' : '添加文件目录' }}
          </h3>
          <button class="dialog__close" aria-label="关闭" @click="closeScanDirDialog">&times;</button>
        </div>

        <div class="dialog__body">
          <p v-if="scanDirFormError" class="notice notice--error" role="alert">{{ scanDirFormError }}</p>

          <div class="field">
            <label for="scan-dir-category">目录分类 *</label>
            <input
              id="scan-dir-category"
              v-model="scanDirForm.category"
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
            <input
              id="scan-dir-path"
              v-model="scanDirForm.path"
              class="input"
              placeholder="如: /Volumes/wdc4t/视频"
            />
          </div>
        </div>

        <div class="dialog__foot">
          <button class="btn" @click="closeScanDirDialog">取消</button>
          <button class="btn btn--primary" :disabled="savingScanDir" @click="saveScanDir">
            <span v-if="savingScanDir" class="spinner"></span>
            {{ savingScanDir ? '保存中...' : '保存' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 友情链接管理 -->
    <section class="panel">
      <div class="panel-head">
        <h2 class="section-title">友情链接</h2>
        <button class="btn btn--sm btn--primary" @click="openAddFriendLinkDialog">添加链接</button>
      </div>

      <div v-if="loadingFriendLinks" class="rows" aria-busy="true">
        <div v-for="n in 3" :key="n" class="skeleton row-skeleton"></div>
      </div>

      <ul v-else-if="friendLinkList.length" class="rows">
        <li v-for="item in friendLinkList" :key="item.id" class="row">
          <div class="row-main">
            <span class="row-title">{{ item.name }}</span>
            <div class="row-tags">
              <span class="row-meta" :title="item.link">{{ item.link }}</span>
              <span v-if="item.description" class="row-meta row-meta--ok" :title="item.description">{{ item.description }}</span>
              <span class="tag">排序 {{ item.sortorder || 0 }}</span>
            </div>
          </div>
          <div class="row-actions">
            <button class="btn btn--sm" @click="openEditFriendLinkDialog(item)">编辑</button>
            <button class="btn btn--sm btn--danger" @click="deleteFriendLink(item)">删除</button>
          </div>
        </li>
      </ul>

      <div v-else class="empty">
        <p>暂无友情链接</p>
        <button class="btn btn--sm" @click="openAddFriendLinkDialog">添加第一条链接</button>
      </div>
    </section>

    <!-- 友情链接弹窗 -->
    <div v-if="showFriendLinkDialog" class="overlay" @click.self="closeFriendLinkDialog">
      <div class="dialog dialog--form" role="dialog" aria-modal="true" aria-labelledby="link-dialog-title">
        <div class="dialog__head">
          <h3 class="dialog__title" id="link-dialog-title">
            {{ editingFriendLink ? '编辑链接' : '添加链接' }}
          </h3>
          <button class="dialog__close" aria-label="关闭" @click="closeFriendLinkDialog">&times;</button>
        </div>

        <div class="dialog__body">
          <p v-if="friendLinkFormError" class="notice notice--error" role="alert">{{ friendLinkFormError }}</p>

          <div class="field">
            <label for="link-name">名称 *</label>
            <input id="link-name" v-model="friendLinkForm.name" class="input" placeholder="链接显示名称" />
          </div>
          <div class="field">
            <label for="link-url">网址 *</label>
            <input id="link-url" v-model="friendLinkForm.link" class="input" placeholder="https://example.com" />
          </div>
          <div class="field">
            <label for="link-logo">Logo</label>
            <input id="link-logo" v-model="friendLinkForm.logo" class="input" placeholder="Logo 图片地址（选填）" />
          </div>
          <div class="field">
            <label for="link-desc">描述</label>
            <input id="link-desc" v-model="friendLinkForm.description" class="input" placeholder="链接描述（选填）" />
          </div>
          <div class="field">
            <label for="link-sort">排序</label>
            <input
              id="link-sort"
              v-model.number="friendLinkForm.sortorder"
              class="input"
              type="number"
              placeholder="数字越小越靠前"
            />
          </div>
        </div>

        <div class="dialog__foot">
          <button class="btn" @click="closeFriendLinkDialog">取消</button>
          <button class="btn btn--primary" :disabled="savingLink" @click="saveFriendLink">
            <span v-if="savingLink" class="spinner"></span>
            {{ savingLink ? '保存中...' : '保存' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api, { settingApi, friendLinkApi, scanDirectoryApi } from '@/scripts/api'
import { useAppStore } from '@/scripts/store/app'
import { useUiStore } from '@/scripts/store/ui'

const app = useAppStore()
const ui = useUiStore()

const CATEGORY_OPTIONS = ['视频', '封面', '字幕']

/**
 * 5 项站点设置。
 * content 一律按字符串提交（后端存的就是字符串），所以这里不能用 v-model.number。
 */
const settingsList = ref([
  { id: 'siteName', label: '网站名称', value: '', placeholder: '影视网站', hint: '显示在页头与浏览器标签' },
  { id: 'pageSize', label: '每页数量', value: '', type: 'number', min: 1, max: 100, placeholder: '默认 24', hint: '各列表页每页显示的条数' },
  { id: 'homePageCategories', label: '首页展示分类', value: '', placeholder: '多个分类用逗号分隔，留空显示全部' },
  { id: 'homePageCategoryCount', label: '首页分类数量', value: '', type: 'number', min: 1, max: 100, placeholder: '每个分类/板块显示数量，默认 12' },
  { id: 'posterDir', label: '海报墙目录', value: '', placeholder: '如: /Volumes/disk1/posters' }
])

// 写操作反馈：留在页面上直到下一次操作，不再定时隐藏
const feedback = ref({ text: '', type: 'success' })
const say = (text, type = 'success') => { feedback.value = { text, type } }

// 读取状态
const loadingSettings = ref(true)
const loadingScanDirs = ref(true)
const loadingFriendLinks = ref(true)
const loadError = ref('')

const savingBasic = ref(false)
const savingScanDir = ref(false)
const savingLink = ref(false)

// 文件目录
const scanDirList = ref([])
const showScanDirDialog = ref(false)
const editingScanDir = ref(null)
const scanDirForm = ref({ path: '', category: '' })
const scanDirFormError = ref('')

// 友情链接
const friendLinkList = ref([])
const showFriendLinkDialog = ref(false)
const editingFriendLink = ref(null)
const friendLinkForm = ref({ name: '', link: '', logo: '', description: '', sortorder: 0 })
const friendLinkFormError = ref('')

const loadAll = async () => {
  loadError.value = ''
  await Promise.all([loadSettings(), loadScanDirList(), loadFriendLinkList()])
}

onMounted(loadAll)

const loadSettings = async () => {
  loadingSettings.value = true
  try {
    // 每项一个 GET /api/systemsetting/{name}，并行发出
    const results = await Promise.allSettled(settingsList.value.map((item) => settingApi.getByName(item.id)))
    const failed = []
    results.forEach((result, i) => {
      const item = settingsList.value[i]
      if (result.status === 'fulfilled' && result.value?.success) {
        if (result.value.data) item.value = result.value.data
      } else {
        failed.push(item.label)
      }
    })
    if (failed.length) loadError.value = `以下设置加载失败：${failed.join('、')}`
  } catch (error) {
    console.error('加载设置失败:', error)
    loadError.value = '系统设置加载失败，请确认后端服务可用'
  } finally {
    loadingSettings.value = false
  }
}

const loadScanDirList = async () => {
  loadingScanDirs.value = true
  try {
    const res = await scanDirectoryApi.getList()
    if (res.success) scanDirList.value = res.data || []
    else loadError.value = res.message || '文件目录加载失败'
  } catch (error) {
    console.error('加载文件目录失败:', error)
    loadError.value = '文件目录加载失败，请确认后端服务可用'
  } finally {
    loadingScanDirs.value = false
  }
}

const loadFriendLinkList = async () => {
  loadingFriendLinks.value = true
  try {
    const res = await friendLinkApi.getList()
    if (res.success) friendLinkList.value = res.data || []
    else loadError.value = res.message || '友情链接加载失败'
  } catch (error) {
    console.error('加载链接列表失败:', error)
    loadError.value = '友情链接加载失败，请确认后端服务可用'
  } finally {
    loadingFriendLinks.value = false
  }
}

/**
 * 保存基本信息。
 * 后端只有单条写入接口，所以这里并行发出 N 个 POST，任一条失败都要报出来；
 * 成功后刷新 store，页头/页脚/各列表页立即读到新值。
 */
const saveBasicSettings = async () => {
  if (savingBasic.value) return
  savingBasic.value = true
  try {
    const results = await Promise.allSettled(
      settingsList.value.map((item) => settingApi.save({ name: item.id, content: item.value }))
    )
    const failed = settingsList.value
      .filter((_, i) => results[i].status !== 'fulfilled' || !results[i].value?.success)
      .map((item) => item.label)
    if (failed.length) {
      say(`保存失败：${failed.join('、')}`, 'error')
    } else {
      await app.refresh()
      say('保存成功')
    }
  } catch (error) {
    console.error('保存设置失败:', error)
    say('保存失败：' + (error.message || error), 'error')
  } finally {
    savingBasic.value = false
  }
}

// ---------- 文件目录 ----------

const openAddScanDirDialog = () => {
  editingScanDir.value = null
  scanDirForm.value = { path: '', category: '' }
  scanDirFormError.value = ''
  showScanDirDialog.value = true
}

const openEditScanDirDialog = (item) => {
  editingScanDir.value = item
  scanDirForm.value = { path: item.path || '', category: item.category || '' }
  scanDirFormError.value = ''
  showScanDirDialog.value = true
}

function closeScanDirDialog() {
  showScanDirDialog.value = false
  scanDirFormError.value = ''
}

/** 校验接口没有收进 scanDirectoryApi，走同一个 axios 实例，路径与请求体保持不变 */
const checkDirExists = async (path) => {
  const res = await api.post('/scandirectory/check', { path })
  return !!(res?.success && res.exists)
}

const saveScanDir = async () => {
  if (savingScanDir.value) return
  scanDirFormError.value = ''
  if (!scanDirForm.value.path) {
    scanDirFormError.value = '目录路径不能为空'
    return
  }

  savingScanDir.value = true
  try {
    let exists
    try {
      exists = await checkDirExists(scanDirForm.value.path)
    } catch (error) {
      console.error('校验目录失败:', error)
      scanDirFormError.value = '目录校验请求失败，请确认后端服务可用'
      return
    }
    if (!exists) {
      scanDirFormError.value = '目录路径不存在，请检查后重试'
      return
    }

    const payload = {
      path: scanDirForm.value.path,
      category: scanDirForm.value.category
    }
    const res = editingScanDir.value
      ? await scanDirectoryApi.update(editingScanDir.value.id, payload)
      : await scanDirectoryApi.add(payload)

    if (res.success) {
      showScanDirDialog.value = false
      say(editingScanDir.value ? '目录已更新' : '目录已添加')
      await loadScanDirList()
    } else {
      scanDirFormError.value = res.message || '保存失败'
    }
  } catch (error) {
    console.error('保存文件目录失败:', error)
    scanDirFormError.value = '保存失败: ' + (error.message || error)
  } finally {
    savingScanDir.value = false
  }
}

const deleteScanDir = async (item) => {
  const go = await ui.confirm({
    title: '确认删除',
    message: `确定删除文件目录 "${item.path}" 吗？`,
    danger: true
  })
  if (!go) return
  try {
    const res = await scanDirectoryApi.delete(item.id)
    if (res.success) {
      say('删除成功')
      await loadScanDirList()
    } else {
      say(res.message || '删除失败', 'error')
    }
  } catch (error) {
    console.error('删除文件目录失败:', error)
    say('删除失败: ' + (error.message || error), 'error')
  }
}

// ---------- 友情链接 ----------

const openAddFriendLinkDialog = () => {
  editingFriendLink.value = null
  friendLinkForm.value = { name: '', link: '', logo: '', description: '', sortorder: 0 }
  friendLinkFormError.value = ''
  showFriendLinkDialog.value = true
}

const openEditFriendLinkDialog = (item) => {
  editingFriendLink.value = item
  friendLinkForm.value = {
    name: item.name || '',
    link: item.link || '',
    logo: item.logo || '',
    description: item.description || '',
    sortorder: item.sortorder || 0
  }
  friendLinkFormError.value = ''
  showFriendLinkDialog.value = true
}

function closeFriendLinkDialog() {
  showFriendLinkDialog.value = false
  friendLinkFormError.value = ''
}

const saveFriendLink = async () => {
  if (savingLink.value) return
  friendLinkFormError.value = ''
  if (!friendLinkForm.value.name) {
    friendLinkFormError.value = '名称不能为空'
    return
  }
  if (!friendLinkForm.value.link) {
    friendLinkFormError.value = '网址不能为空'
    return
  }

  savingLink.value = true
  try {
    // 后端字段名是小写 sortorder，不要"顺手修正"成 sortOrder
    const payload = {
      name: friendLinkForm.value.name,
      link: friendLinkForm.value.link,
      logo: friendLinkForm.value.logo,
      description: friendLinkForm.value.description,
      sortorder: friendLinkForm.value.sortorder || 0
    }
    const res = editingFriendLink.value
      ? await friendLinkApi.update(editingFriendLink.value.id, payload)
      : await friendLinkApi.add(payload)

    if (res.success) {
      showFriendLinkDialog.value = false
      say(editingFriendLink.value ? '链接已更新' : '链接已添加')
      await loadFriendLinkList()
      // AppFooter 仍监听这个事件
      window.dispatchEvent(new CustomEvent('friendLinksUpdated'))
    } else {
      friendLinkFormError.value = res.message || '保存失败'
    }
  } catch (error) {
    console.error('保存链接失败:', error)
    friendLinkFormError.value = '保存失败: ' + (error.message || error)
  } finally {
    savingLink.value = false
  }
}

const deleteFriendLink = async (item) => {
  const go = await ui.confirm({
    title: '确认删除',
    message: `确定删除链接 "${item.name}" 吗？`,
    danger: true
  })
  if (!go) return
  try {
    const res = await friendLinkApi.delete(item.id)
    if (res.success) {
      say('删除成功')
      await loadFriendLinkList()
      window.dispatchEvent(new CustomEvent('friendLinksUpdated'))
    } else {
      say(res.message || '删除失败', 'error')
    }
  } catch (error) {
    console.error('删除链接失败:', error)
    say('删除失败: ' + (error.message || error), 'error')
  }
}
</script>

<style scoped>
.settings {
  display: flex;
  flex-direction: column;
  gap: var(--s4);
}

.panel {
  display: flex;
  flex-direction: column;
  gap: var(--s3);
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--s3);
  flex-wrap: wrap;
}

.panel-foot {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--s3);
  flex-wrap: wrap;
}

.settings-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: var(--s3);
}

.field-skeleton {
  height: 62px;
}

.hint {
  font-size: var(--f-xs);
  color: var(--text-dim);
}

.feedback {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--s3);
}

.notice--success {
  border-color: var(--success);
  background: var(--success-soft);
  color: var(--success);
}

.rows {
  display: flex;
  flex-direction: column;
  gap: var(--s2);
  list-style: none;
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--s3);
  flex-wrap: wrap;
  padding: var(--s3);
  background: var(--bg-elev-2);
  border: 1px solid var(--border);
  border-radius: var(--r1);
  transition: border-color var(--dur) var(--ease);
}

.row:hover {
  border-color: var(--border-strong);
}

.row-skeleton {
  height: 72px;
  border-radius: var(--r1);
}

.row-main {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 200px;
  flex: 1;
}

.row-title {
  font-weight: 600;
  word-break: break-all;
}

.row-tags {
  display: flex;
  align-items: center;
  gap: var(--s2);
  flex-wrap: wrap;
  min-width: 0;
}

/* 链接与描述是自由文本，不能当 nowrap 标签用，否则会撑破行 */
.row-meta {
  min-width: 0;
  max-width: 100%;
  font-size: var(--f-xs);
  color: var(--text-dim);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.row-meta--ok {
  color: var(--success);
}

.row-actions {
  display: flex;
  gap: var(--s2);
}

.dialog--form {
  max-width: 460px;
}

.check {
  display: flex;
  align-items: center;
  gap: var(--s2);
  font-size: var(--f-md);
  cursor: pointer;
}

.check input {
  width: 16px;
  height: 16px;
  accent-color: var(--accent);
  cursor: pointer;
}
</style>
