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

    <div class="settings-layout">
      <!-- 标签式导航：点一个只看一个分区。锚点滚动定位在手机上要滚很久，高亮也跟不上 -->
      <div
        ref="navEl"
        class="settings-nav"
        role="tablist"
        aria-label="设置分组"
        aria-orientation="vertical"
        @keydown="onTabKey"
      >
        <button
          v-for="g in GROUPS"
          :id="'tab-' + g.id"
          :key="g.id"
          type="button"
          role="tab"
          class="settings-nav__link"
          :class="{ active: activeGroup === g.id }"
          :aria-selected="activeGroup === g.id ? 'true' : 'false'"
          :aria-controls="'panel-' + g.id"
          :tabindex="activeGroup === g.id ? 0 : -1"
          @click="selectGroup(g.id)"
        >
{{ g.label }}
</button>
      </div>

      <div class="settings-body">
        <!-- 数据源：地区与分类的规范可选值 -->
        <section
          v-if="activeGroup === 'taxonomy'"
          id="panel-taxonomy"
          class="panel settings-group"
          role="tabpanel"
          aria-labelledby="tab-taxonomy"
          tabindex="-1"
        >
          <h2 class="section-title">数据源</h2>
          <p class="panel-desc">
            影片、系列、演员的「地区」和影片的「分类」都从这两份清单里取，所以各页面的下拉框永远一致。
            改名会把已经用着旧值的记录一起更新；删除只从可选值里去掉，不动任何记录。
          </p>

          <div v-if="loadingTaxonomy" class="taxonomy-grid" aria-busy="true">
            <div class="skeleton block-skeleton"></div>
            <div class="skeleton block-skeleton"></div>
          </div>

          <p v-else-if="taxonomyError" class="notice notice--error" role="alert">
            <span>{{ taxonomyError }}</span>
            <button class="btn btn--sm" @click="loadTaxonomy">重试</button>
          </p>

          <div v-else class="taxonomy-grid">
            <TaxonomyTable
              kind="countries"
              label="地区"
              :rows="countryRows"
              :orphans="countryOrphans"
              placeholder="如：泰国"
              hint="顺序就是各页面下拉框里的显示顺序"
              @saved="loadTaxonomy"
            />
            <TaxonomyTable
              kind="categories"
              label="分类"
              :rows="categoryRows"
              :orphans="categoryOrphans"
              placeholder="如：同人志"
              hint="首页展示哪几个分类，由「首页」分组的「首页展示分类」决定"
              @saved="loadTaxonomy"
            />
          </div>
        </section>

        <!-- 扫描目录 -->
        <section
          v-else-if="activeGroup === 'dirs'"
          id="panel-dirs"
          class="panel settings-group"
          role="tabpanel"
          aria-labelledby="tab-dirs"
          tabindex="-1"
        >
          <div class="panel-head">
            <div class="panel-head__text">
              <h2 class="section-title">扫描目录</h2>
              <p class="panel-desc">导入影片、封面、字幕时从哪里找文件。</p>
            </div>
            <button class="btn btn--sm" @click="openAddScanDirDialog">添加</button>
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

        <!-- 友情链接 -->
        <section
          v-else-if="activeGroup === 'links'"
          id="panel-links"
          class="panel settings-group"
          role="tabpanel"
          aria-labelledby="tab-links"
          tabindex="-1"
        >
          <div class="panel-head">
            <div class="panel-head__text">
              <h2 class="section-title">友情链接</h2>
              <p class="panel-desc">显示在页脚，按排序数字从小到大排列。</p>
            </div>
            <button class="btn btn--sm" @click="openAddFriendLinkDialog">添加</button>
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

        <!-- 其余分区都是一组单值设置 -->
        <section
          v-else
          :id="'panel-' + activeGroup"
          class="panel settings-group"
          role="tabpanel"
          :aria-labelledby="'tab-' + activeGroup"
          tabindex="-1"
        >
          <h2 class="section-title">{{ activeFieldGroup.label }}</h2>
          <p class="panel-desc">{{ activeFieldGroup.desc }}</p>

          <div v-if="loadingSettings" class="settings-grid" aria-busy="true">
            <div v-for="n in activeFieldGroup.items.length" :key="n" class="skeleton field-skeleton"></div>
          </div>

          <div v-else class="settings-grid">
            <div v-for="item in activeFieldGroup.items" :key="item.id" class="field">
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
            <span class="hint">本组 {{ activeFieldGroup.items.length }} 项</span>
            <button class="btn btn--primary" :disabled="savingGroup !== '' || loadingSettings" @click="saveGroup(activeFieldGroup)">
              <span v-if="savingGroup === activeGroup" class="spinner"></span>
              保存{{ activeFieldGroup.label }}
            </button>
          </div>
        </section>
      </div>
    </div>

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
import { computed, nextTick, onMounted, ref } from 'vue'
import api, { settingApi, friendLinkApi, scanDirectoryApi, taxonomyApi } from '@/scripts/api'
import { useAppStore } from '@/scripts/store/app'
import { useUiStore } from '@/scripts/store/ui'
import TaxonomyTable from '@/views/components/TaxonomyTable.vue'

const app = useAppStore()
const ui = useUiStore()

const CATEGORY_OPTIONS = ['视频', '封面', '字幕']

/** 分区的唯一来源：导航项与各分区标题读这里，新增分组只改这一份 */
const GROUPS = [
  { id: 'site', label: '站点信息', desc: '网站名称与各列表页的分页条数。' },
  { id: 'home', label: '首页', desc: '首页取哪几个分类、每个分类显示多少条。' },
  { id: 'media', label: '媒体路径', desc: '艳图与演员海报使用的图片目录；影片扫描目录见「扫描目录」。' },
  { id: 'taxonomy', label: '数据源' },
  { id: 'dirs', label: '扫描目录' },
  { id: 'links', label: '友情链接' }
]

/** content 一律按字符串提交（后端存的就是字符串），所以这里不能用 v-model.number */
const settingsList = ref([
  { id: 'siteName', group: 'site', label: '网站名称', value: '', placeholder: '影视网站', hint: '显示在页头与浏览器标签' },
  { id: 'pageSize', group: 'site', label: '每页数量', value: '', type: 'number', min: 1, max: 100, placeholder: '默认 24', hint: '各列表页每页显示的条数' },
  { id: 'homePageCategories', group: 'home', label: '首页展示分类', value: '', placeholder: '多个分类用逗号分隔，留空显示全部', hint: '可选值见「数据源」' },
  { id: 'homePageCategoryCount', group: 'home', label: '首页分类数量', value: '', type: 'number', min: 1, max: 100, placeholder: '默认 12', hint: '每个分类/板块显示的数量，今日推荐也用这个值' },
  { id: 'posterDir', group: 'media', label: '艳图目录', value: '', placeholder: '如: /Volumes/disk1/posters' }
])

const fieldGroups = computed(() =>
  GROUPS
    .map((g) => ({ ...g, items: settingsList.value.filter((i) => i.group === g.id) }))
    .filter((g) => g.items.length)
)

// 写操作反馈：留在页面上直到下一次操作，不再定时隐藏
const feedback = ref({ text: '', type: 'success' })
const say = (text, type = 'success') => { feedback.value = { text, type } }

// 读取状态
const loadingSettings = ref(true)
const loadingTaxonomy = ref(true)
const loadingScanDirs = ref(true)
const loadingFriendLinks = ref(true)
const loadError = ref('')
const taxonomyError = ref('')

// 一次只有一个分组在写，用分组 id 表示，按钮的禁用与转圈都看它
const savingGroup = ref('')
const savingScanDir = ref(false)
const savingLink = ref(false)

const countryRows = ref([])
const countryOrphans = ref([])
const categoryRows = ref([])
const categoryOrphans = ref([])

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
  await Promise.all([loadSettings(), loadTaxonomy(), loadScanDirList(), loadFriendLinkList()])
}

/** 一次 GET /api/systemsetting 拿全部设置：缺键就是"没配过"，不算失败 */
const loadSettings = async () => {
  loadingSettings.value = true
  try {
    const res = await settingApi.getAll()
    if (!res?.success) throw new Error(res?.message || '加载失败')
    const map = {}
    ;(res.data || []).forEach((row) => { map[row.name] = row.content })
    settingsList.value.forEach((item) => { if (map[item.id]) item.value = map[item.id] })
  } catch (error) {
    console.error('加载设置失败:', error)
    loadError.value = '系统设置加载失败，请确认后端服务可用'
  } finally {
    loadingSettings.value = false
  }
}

/** 清单与引用数一次给全，管理表格"被使用"那一列就是这份统计 */
const loadTaxonomy = async () => {
  loadingTaxonomy.value = true
  taxonomyError.value = ''
  try {
    const res = await taxonomyApi.get()
    if (!res?.success) throw new Error(res?.message || '加载失败')
    const data = res.data || {}
    countryRows.value = data.countries || []
    countryOrphans.value = data.countryOrphans || []
    categoryRows.value = data.categories || []
    categoryOrphans.value = data.categoryOrphans || []
  } catch (error) {
    console.error('加载数据源失败:', error)
    taxonomyError.value = '数据源加载失败，请确认后端服务可用'
  } finally {
    loadingTaxonomy.value = false
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

/** 后端只有单条写入接口，所以一组就是并行 N 个 POST，任一条失败都要报出来 */
const saveItems = async (items, name) => {
  if (savingGroup.value) return false
  savingGroup.value = name
  try {
    const results = await Promise.allSettled(
      items.map((item) => settingApi.save({ name: item.id, content: item.value }))
    )
    const failed = items
      .filter((_, i) => results[i].status !== 'fulfilled' || !results[i].value?.success)
      .map((item) => item.label)
    if (failed.length) {
      say(`保存失败：${failed.join('、')}`, 'error')
      return false
    }
    return true
  } catch (error) {
    console.error('保存设置失败:', error)
    say('保存失败：' + (error.message || error), 'error')
    return false
  } finally {
    savingGroup.value = ''
  }
}

/** 成功后刷新 store，页头/页脚/各列表页立即读到新值 */
const saveGroup = async (group) => {
  if (await saveItems(group.items, group.id)) {
    await app.refresh()
    say(`已保存${group.label}`)
  }
}

// ---------- 分区标签 ----------

const activeGroup = ref(GROUPS[0].id)
const navEl = ref(null)

const activeFieldGroup = computed(
  () => fieldGroups.value.find((g) => g.id === activeGroup.value) || fieldGroups.value[0]
)

/** 引用数会随别处的修改变化，每次进数据源标签都重新拉一次 */
const selectGroup = (id) => {
  if (activeGroup.value === id) return
  activeGroup.value = id
  if (id === 'taxonomy' && !loadingTaxonomy.value) loadTaxonomy()
}

/** role=tablist 的键盘约定：方向键在标签间移动，Tab 仍然只停一次 */
const onTabKey = async (event) => {
  const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key]
  if (!step) return
  event.preventDefault()

  const ids = GROUPS.map((g) => g.id)
  const next = (ids.indexOf(activeGroup.value) + step + ids.length) % ids.length
  selectGroup(ids[next])
  await nextTick()
  navEl.value?.querySelector('.settings-nav__link.active')?.focus()
}

onMounted(loadAll)

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
  gap: var(--s4);
}

.settings-layout {
  display: grid;
  grid-template-columns: 168px minmax(0, 1fr);
  gap: var(--s6);
  align-items: start;
}

.settings-nav {
  display: flex;
  flex-direction: column;
  gap: var(--s1);
}

.settings-nav__link {
  display: flex;
  align-items: center;
  height: var(--ctl-h-sm);
  padding-inline: var(--ctl-pad-x-sm);
  border: 1px solid transparent;
  border-radius: var(--r1);
  font-size: var(--f-md);
  color: var(--text-dim);
  text-align: left;
  white-space: nowrap;
  cursor: pointer;
  transition: background var(--dur) var(--ease), border-color var(--dur) var(--ease),
    color var(--dur) var(--ease);
}

.settings-nav__link:hover {
  background: var(--bg-hover);
  color: var(--text);
}

/* 只靠底色在手机弱屏上认不出，选中项再加一圈描边 */
.settings-nav__link.active {
  background: var(--accent-soft);
  border-color: var(--accent);
  color: var(--accent);
  font-weight: 600;
}

.settings-body {
  display: flex;
  flex-direction: column;
  gap: var(--s4);
  min-width: 0;
}

.settings-group {
  gap: var(--s3);
}

.panel {
  display: flex;
  flex-direction: column;
  gap: var(--s3);
}

.panel-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--s3);
  flex-wrap: wrap;
}

.panel-head__text {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.panel-desc {
  font-size: var(--f-sm);
  color: var(--text-dim);
  line-height: 1.6;
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

/* 两份清单各占一栏，放不下叠成一列 */
.taxonomy-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
  gap: var(--s5);
}

.field-skeleton {
  height: 62px;
}

.block-skeleton {
  height: 220px;
  border-radius: var(--r1);
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

@media (max-width: 899px) {
  .settings-layout {
    grid-template-columns: minmax(0, 1fr);
  }

  /* 单列时导航变成一行可横滑的标签条 */
  .settings-nav {
    flex-direction: row;
    overflow-x: auto;
    scrollbar-width: none;
  }
}
</style>
