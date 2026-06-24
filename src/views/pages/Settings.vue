<template>
  <div class="settings">
    <h1>系统设置</h1>

    <!-- 页面提示 -->
    <div v-if="pageTip.show" class="inline-tip" :class="pageTip.type">
      <span>{{ pageTip.message }}</span>
      <span class="tip-close" @click="pageTip.show = false">×</span>
    </div>

    <!-- 基本信息 -->
    <div class="settings-section">
      <h2>基本信息</h2>
      <div class="setting-item" v-for="item in settingsList" :key="item.id">
        <label>{{ item.label }}</label>
        <input v-if="item.id === 'pageSize'" v-model="item.value" type="number" min="1" max="100" placeholder="默认 24" style="max-width:120px" />
        <input v-else v-model="item.value" :placeholder="item.placeholder" />
      </div>
      <div class="section-actions">
        <button class="save-btn" @click="saveBasicSettings" :disabled="savingBasic">保存基本信息</button>
      </div>
    </div>

    <!-- 扫描目录管理 -->
    <div class="settings-section">
      <h2>
        扫描目录
        <button class="add-btn" @click="openAddScanDirDialog">+ 添加目录</button>
        <button class="scan-all-btn" @click="scanAllDirs" :disabled="scanning || scanDirList.length === 0">
          {{ scanning ? '扫描中...' : '扫描全部' }}
        </button>
      </h2>
      <div class="scan-list" v-if="scanDirList.length > 0">
        <div class="scan-item" v-for="item in scanDirList" :key="item.id">
          <div class="scan-info">
            <div class="scan-path">{{ item.path }}</div>
            <div class="scan-meta">
              <span class="meta-tag" v-if="item.category">{{ item.category }}</span>
              <span class="meta-tag green" v-if="item.recursive">递归</span>
              <span class="meta-tag green" v-if="item.autoCreateSeries">自动系列</span>
            </div>
          </div>
          <div class="scan-actions">
            <button class="btn-edit" @click="openEditScanDirDialog(item)">编辑</button>
            <button class="btn-delete" @click="deleteScanDir(item)">删除</button>
          </div>
        </div>
      </div>
      <div class="empty-tip" v-else>暂无扫描目录，点击上方按钮添加</div>
    </div>

    <!-- 扫描目录弹窗 -->
    <div class="dialog-overlay" v-if="showScanDirDialog"
         @mousedown="handleScanDirOverlayDown"
         @click="handleScanDirOverlayClick">
      <div class="dialog">
        <div class="dialog-header">
          <h3>{{ editingScanDir ? '编辑扫描目录' : '添加扫描目录' }}</h3>
        </div>
        <div class="dialog-body">
          <div class="form-group">
            <label>目录路径 *</label>
            <input v-model="scanDirForm.path" placeholder="如: /Volumes/wdc4t/视频" />
          </div>
          <div class="form-group">
            <label>分类</label>
            <div class="combobox-wrap">
              <input
                v-model="scanDirForm.category"
                placeholder="选择或输入分类"
                @focus="showCatDropdown = true"
                @blur="hideCatDropdown"
              />
              <div v-if="showCatDropdown" class="combobox-dropdown">
                <div class="combobox-option" @mousedown.prevent="selectCat('')">（无分类）</div>
                <div v-for="c in categories" :key="c" class="combobox-option" @mousedown.prevent="selectCat(c)">{{ c }}</div>
              </div>
            </div>
          </div>
          <div class="form-group form-check">
            <label><input type="checkbox" v-model="scanDirForm.recursive" /> 递归扫描子目录</label>
          </div>
          <div class="form-group form-check">
            <label><input type="checkbox" v-model="scanDirForm.autoCreateSeries" /> 自动添加新系列</label>
          </div>
        </div>
        <div class="dialog-footer">
          <span v-if="dialogTip.show" class="dialog-tip">{{ dialogTip.message }}</span>
          <button class="btn btn-cancel" @click="closeScanDirDialog">取消</button>
          <button class="btn btn-confirm" @click="saveScanDir" :disabled="saving">{{ saving ? '保存中...' : '保存' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { settingApi, videoApi } from '@/scripts/api'

const settingsList = ref([
  { id: 'siteName', label: '网站名称', value: '', placeholder: '影视网站' },
  { id: 'scanType', label: '扫描类型', value: '', placeholder: '如: .mp4,.mkv,.avi（多个后缀以逗号分隔）' },
  { id: 'pageSize', label: '每页数量', value: '', placeholder: '列表每页显示数量，默认 24' }
])
const savingBasic = ref(false)

// 页面提示
const pageTip = ref({ show: false, message: '', type: 'error' })
function showPageTip(msg, type = 'error') {
  pageTip.value = { show: true, message: msg, type }
  setTimeout(() => { pageTip.value.show = false }, 3000)
}

// 弹窗内提示
const dialogTip = ref({ show: false, message: '' })
function showDialogTip(msg) {
  dialogTip.value = { show: true, message: msg }
}
function clearDialogTip() {
  dialogTip.value.show = false
}

// 扫描目录
const scanDirList = ref([])
const showScanDirDialog = ref(false)
const editingScanDir = ref(null)
const scanDirForm = ref({ path: '', recursive: true, category: '', autoCreateSeries: false })
const showCatDropdown = ref(false)
const categories = ref([])

const hideCatDropdown = () => { setTimeout(() => { showCatDropdown.value = false }, 200) }
const selectCat = (val) => { scanDirForm.value.category = val; showCatDropdown.value = false }

const loadCategories = async () => {
  try {
    const res = await videoApi.getMeta()
    if (res.success) categories.value = res.categories || []
  } catch (error) {
    console.error('加载分类失败:', error)
  }
}
const saving = ref(false)
const scanning = ref(false)

// 弹窗点击穿透处理
let mouseDownOnDialog = false
function handleScanDirOverlayDown(e) {
  const dialog = e.currentTarget.querySelector('.dialog')
  mouseDownOnDialog = dialog && dialog.contains(e.target)
}
function handleScanDirOverlayClick() {
  if (!mouseDownOnDialog) showScanDirDialog.value = false
}
function closeScanDirDialog() {
  showScanDirDialog.value = false
  clearDialogTip()
}

onMounted(async () => {
  await loadSettings()
  await loadScanDirList()
  await loadCategories()
})

const loadSettings = async () => {
  for (const item of settingsList.value) {
    try {
      const res = await settingApi.getByName(item.id)
      if (res.success && res.data) item.value = res.data
    } catch (error) {
      console.error(`加载${item.label}失败:`, error)
    }
  }
}

// 保存基本信息（全部字段一次性保存）
// 只有网站名称变更时才通知 Header 更新标题
const saveBasicSettings = async () => {
  savingBasic.value = true
  let siteNameChanged = false
  try {
    for (const item of settingsList.value) {
      const res = await settingApi.save({ name: item.id, content: item.value })
      if (res.success && item.id === 'siteName') {
        siteNameChanged = true
      }
    }
    if (siteNameChanged) {
      window.dispatchEvent(new CustomEvent('settingsUpdated'))
    }
    showPageTip('保存成功', 'success')
  } catch (error) {
    showPageTip('保存失败：' + error.message, 'error')
  } finally {
    savingBasic.value = false
  }
}

// 校验目录是否存在
const checkDirExists = async (path) => {
  try {
    const res = await fetch('/api/scandirectory/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path })
    }).then(r => r.json())
    return res.success && res.exists
  } catch {
    return false
  }
}

// 扫描目录管理
const loadScanDirList = async () => {
  try {
    const res = await fetch('/api/scandirectory').then(r => r.json())
    if (res.success) scanDirList.value = res.data || []
  } catch (error) {
    console.error('加载扫描目录失败:', error)
  }
}

const openAddScanDirDialog = () => {
  editingScanDir.value = null
  scanDirForm.value = { path: '', recursive: true, category: '', autoCreateSeries: false }
  clearDialogTip()
  showScanDirDialog.value = true
}

const openEditScanDirDialog = (item) => {
  editingScanDir.value = item
  scanDirForm.value = {
    path: item.path,
    recursive: item.recursive,
    category: item.category || '',
    autoCreateSeries: item.autoCreateSeries || false
  }
  clearDialogTip()
  showScanDirDialog.value = true
}

const saveScanDir = async () => {
  clearDialogTip()
  if (!scanDirForm.value.path) {
    showDialogTip('目录路径不能为空')
    return
  }
  if (!await checkDirExists(scanDirForm.value.path)) {
    showDialogTip('目录路径不存在，请检查后重试')
    return
  }
  saving.value = true
  try {
    let res
    if (editingScanDir.value) {
      res = await fetch(`/api/scandirectory/${editingScanDir.value.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scanDirForm.value)
      }).then(r => r.json())
    } else {
      res = await fetch('/api/scandirectory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scanDirForm.value)
      }).then(r => r.json())
    }
    if (res.success) {
      showScanDirDialog.value = false
      await loadScanDirList()
    } else {
      showDialogTip(res.message || '保存失败')
    }
  } catch (error) {
    showDialogTip('保存失败: ' + error.message)
  } finally {
    saving.value = false
  }
}

const deleteScanDir = async (item) => {
  if (!confirm(`确定删除扫描目录 "${item.path}" 吗？`)) return
  try {
    const res = await fetch(`/api/scandirectory/${item.id}`, { method: 'DELETE' }).then(r => r.json())
    if (res.success) {
      showPageTip('删除成功', 'success')
      await loadScanDirList()
    } else {
      showPageTip(res.message || '删除失败', 'error')
    }
  } catch (error) {
    showPageTip('删除失败: ' + error.message, 'error')
  }
}

// 扫描所有目录
const scanAllDirs = async () => {
  if (scanDirList.value.length === 0) return
  if (!confirm(`确定扫描全部 ${scanDirList.value.length} 个目录吗？`)) return
  scanning.value = true
  try {
    const res = await videoApi.scanAll()
    if (res.success) {
      showPageTip(`扫描任务已启动！任务ID: ${res.data?.taskId}`, 'success')
    } else {
      showPageTip(res.message || '扫描失败', 'error')
    }
  } catch (error) {
    showPageTip('扫描失败: ' + error.message, 'error')
  }
  scanning.value = false
}
</script>

<style scoped>
.settings { padding: 20px; max-width: 900px; margin: 0 auto; }
h1 { margin-bottom: 24px; color: #333; }
h2 { margin-bottom: 16px; font-size: 18px; color: #555; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.settings-section { background: #fff; border-radius: 8px; padding: 20px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
.setting-item { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
.setting-item label { min-width: 100px; color: #666; }
.setting-item input { flex: 1; padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; }
.save-btn { padding: 8px 16px; background: #42b883; color: #fff; border: none; border-radius: 4px; cursor: pointer; }
.save-btn:hover { background: #369870; }
.save-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.section-actions { margin-top: 12px; display: flex; justify-content: flex-end; }
.add-btn { padding: 6px 12px; background: #42b883; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 13px; }
.add-btn:hover { background: #369870; }
.scan-all-btn { padding: 6px 12px; background: #1976d2; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 13px; }
.scan-all-btn:hover:not(:disabled) { background: #1565c0; }
.scan-all-btn:disabled { opacity: 0.6; cursor: not-allowed; }

/* 页面提示 */
.inline-tip {
  padding: 10px 16px;
  border-radius: 6px;
  margin-bottom: 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 14px;
}
.inline-tip.error {
  background: #ffebee;
  color: #c62828;
  border: 1px solid #ef9a9a;
}
.inline-tip.success {
  background: #e8f5e9;
  color: #2e7d32;
  border: 1px solid #a5d6a7;
}
.tip-close {
  cursor: pointer;
  font-size: 18px;
  font-weight: bold;
  margin-left: 16px;
}

.scan-list { margin-top: 12px; }
.scan-item { display: flex; justify-content: space-between; align-items: center; padding: 12px; border: 1px solid #eee; border-radius: 6px; margin-bottom: 8px; }
.scan-info { flex: 1; }
.scan-path { font-weight: 500; color: #333; }
.scan-meta { margin-top: 4px; display: flex; gap: 8px; }
.meta-tag { font-size: 12px; padding: 2px 6px; background: #e3f2fd; color: #1565c0; border-radius: 3px; }
.meta-tag.green { background: #e8f5e9; color: #2e7d32; }
.scan-actions { display: flex; gap: 8px; }
.btn-edit, .btn-delete { padding: 6px 12px; border: none; border-radius: 4px; cursor: pointer; font-size: 13px; }
.btn-edit { background: #ff9800; color: #fff; }
.btn-delete { background: #d32f2f; color: #fff; }
.btn-edit:hover { background: #f57c00; }
.btn-delete:hover { background: #c62828; }

.empty-tip { color: #999; font-size: 14px; padding: 20px; text-align: center; }

.dialog-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.dialog { background: #fff; border-radius: 8px; width: 400px; max-width: 90%; }
.dialog-header { padding: 16px 20px; border-bottom: 1px solid #eee; }
.dialog-header h3 { margin: 0; font-size: 16px; }
.dialog-body { padding: 20px; }
.dialog-footer { padding: 16px 20px; border-top: 1px solid #eee; display: flex; justify-content: flex-end; align-items: center; gap: 12px; }
.form-group { margin-bottom: 16px; }
.form-group label { display: block; margin-bottom: 6px; color: #666; font-size: 14px; }
.form-group input, .form-group select { width: 100%; padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; }
.form-check label { display: flex; align-items: center; gap: 8px; }
.form-check input { width: auto; }
.btn { padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer; }
.btn-cancel { background: #f5f5f5; color: #666; }
.btn-confirm { background: #42b883; color: #fff; }
.btn-cancel:hover { background: #eee; }
.btn-confirm:hover { background: #369870; }
.btn:disabled { opacity: 0.6; cursor: not-allowed; }

/* 弹窗内提示 */
.dialog-tip { color: #d32f2f; font-size: 13px; margin-right: auto; }

/* Combobox */
.combobox-wrap { position: relative; }
.combobox-dropdown { position: absolute; top: 100%; left: 0; right: 0; background: #fff; border: 1px solid #ddd; border-radius: 4px; margin-top: 4px; max-height: 200px; overflow-y: auto; z-index: 10; }
.combobox-option { padding: 8px 12px; cursor: pointer; }
.combobox-option:hover { background: #f5f5f5; }
</style>
