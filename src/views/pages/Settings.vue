<template>
  <div class="settings">
    <h1>系统设置</h1>

    <!-- 基本信息 -->
    <div class="settings-section">
      <h2>基本信息</h2>
      <div class="setting-item" v-for="item in settingsList" :key="item.id">
        <label>{{ item.label }}</label>
        <input v-model="item.value" :placeholder="item.placeholder" />
        <button class="save-btn" @click="saveSetting(item)">保存</button>
      </div>
    </div>

    <!-- 扫描目录管理 -->
    <div class="settings-section">
      <h2>
        扫描目录
        <button class="add-btn" @click="openAddScanDirDialog">+ 添加目录</button>
      </h2>
      <div class="scan-list" v-if="scanDirList.length > 0">
        <div class="scan-item" v-for="item in scanDirList" :key="item.id">
          <div class="scan-info">
            <div class="scan-path">{{ item.path }}</div>
            <div class="scan-meta">
              <span class="meta-tag">{{ item.videoTypes || 'mp4' }}</span>
              <span class="meta-tag" v-if="item.recursive">递归</span>
              <span class="meta-tag" :class="{ disabled: !item.isEnabled }">
                {{ item.isEnabled ? '已启用' : '已禁用' }}
              </span>
            </div>
          </div>
          <div class="scan-actions">
            <button class="btn-scan" @click="scanDir(item)">扫描</button>
            <button class="btn-edit" @click="openEditScanDirDialog(item)">编辑</button>
            <button class="btn-delete" @click="deleteScanDir(item)">删除</button>
          </div>
        </div>
      </div>
      <div class="empty-tip" v-else>暂无扫描目录，点击上方按钮添加</div>
    </div>

    <!-- 视频类型管理 -->
    <div class="settings-section">
      <h2>
        视频类型
        <button class="add-btn" @click="openAddVideoTypeDialog">+ 添加类型</button>
      </h2>
      <div class="type-list" v-if="videoTypeList.length > 0">
        <div class="type-item" v-for="item in videoTypeList" :key="item.id">
          <div class="type-info">
            <span class="type-name">{{ item.name }}</span>
            <span class="type-ext">{{ item.extensions }}</span>
          </div>
          <div class="type-actions">
            <button class="btn-edit" @click="openEditVideoTypeDialog(item)">编辑</button>
            <button class="btn-delete" @click="deleteVideoType(item)">删除</button>
          </div>
        </div>
      </div>
      <div class="empty-tip" v-else>暂无视频类型，点击上方按钮添加</div>
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
            <label>视频类型（逗号分隔）</label>
            <input v-model="scanDirForm.videoTypes" placeholder="如: mp4,mkv,avi" />
          </div>
          <div class="form-group form-check">
            <label><input type="checkbox" v-model="scanDirForm.recursive" /> 递归扫描子目录</label>
          </div>
          <div class="form-group form-check">
            <label><input type="checkbox" v-model="scanDirForm.isEnabled" /> 启用此目录</label>
          </div>
        </div>
        <div class="dialog-footer">
          <button class="btn btn-cancel" @click="showScanDirDialog = false">取消</button>
          <button class="btn btn-confirm" @click="saveScanDir" :disabled="saving">{{ saving ? '保存中...' : '保存' }}</button>
        </div>
      </div>
    </div>

    <!-- 视频类型弹窗 -->
    <div class="dialog-overlay" v-if="showVideoTypeDialog"
         @mousedown="handleVideoTypeOverlayDown"
         @click="handleVideoTypeOverlayClick">
      <div class="dialog">
        <div class="dialog-header">
          <h3>{{ editingVideoType ? '编辑视频类型' : '添加视频类型' }}</h3>
        </div>
        <div class="dialog-body">
          <div class="form-group">
            <label>类型名称 *</label>
            <input v-model="videoTypeForm.name" placeholder="如: mp4" />
          </div>
          <div class="form-group">
            <label>扩展名（逗号分隔）</label>
            <input v-model="videoTypeForm.extensions" placeholder="如: .mp4,.m4v" />
          </div>
          <div class="form-group">
            <label>排序</label>
            <input type="number" v-model.number="videoTypeForm.sortOrder" />
          </div>
        </div>
        <div class="dialog-footer">
          <button class="btn btn-cancel" @click="showVideoTypeDialog = false">取消</button>
          <button class="btn btn-confirm" @click="saveVideoType" :disabled="saving">{{ saving ? '保存中...' : '保存' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { settingApi, videoApi } from '@/scripts/api'

const settingsList = ref([
  { id: 'siteName', label: '网站名称', value: '', placeholder: '影视网站' }
])

// 扫描目录
const scanDirList = ref([])
const showScanDirDialog = ref(false)
const editingScanDir = ref(null)
const scanDirForm = ref({ path: '', videoTypes: 'mp4', recursive: true, isEnabled: true })

// 视频类型
const videoTypeList = ref([])
const showVideoTypeDialog = ref(false)
const editingVideoType = ref(null)
const videoTypeForm = ref({ name: '', extensions: '', sortOrder: 0 })

const saving = ref(false)

// 弹窗点击穿透处理
let mouseDownOnDialog = false
function handleScanDirOverlayDown(e) {
  const dialog = e.currentTarget.querySelector('.dialog')
  mouseDownOnDialog = dialog && dialog.contains(e.target)
}
function handleScanDirOverlayClick() {
  if (!mouseDownOnDialog) showScanDirDialog.value = false
}
function handleVideoTypeOverlayDown(e) {
  const dialog = e.currentTarget.querySelector('.dialog')
  mouseDownOnDialog = dialog && dialog.contains(e.target)
}
function handleVideoTypeOverlayClick() {
  if (!mouseDownOnDialog) showVideoTypeDialog.value = false
}

onMounted(async () => {
  await loadSettings()
  await loadScanDirList()
  await loadVideoTypeList()
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

const saveSetting = async (item) => {
  try {
    const res = await settingApi.save({ name: item.id, content: item.value })
    if (res.success) {
      window.dispatchEvent(new CustomEvent('settingsUpdated', { detail: { siteName: item.value } }))
    }
  } catch (error) {
    console.error('保存失败:', error)
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
  scanDirForm.value = { path: '', videoTypes: 'mp4', recursive: true, isEnabled: true }
  showScanDirDialog.value = true
}

const openEditScanDirDialog = (item) => {
  editingScanDir.value = item
  scanDirForm.value = {
    path: item.path,
    videoTypes: item.videoTypes,
    recursive: item.recursive,
    isEnabled: item.isEnabled
  }
  showScanDirDialog.value = true
}

const saveScanDir = async () => {
  if (!scanDirForm.value.path) {
    alert('目录路径不能为空')
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
      alert(res.message || '保存失败')
    }
  } catch (error) {
    alert('保存失败: ' + error.message)
  } finally {
    saving.value = false
  }
}

const deleteScanDir = async (item) => {
  if (!confirm(`确定删除扫描目录 "${item.path}" 吗？`)) return
  try {
    const res = await fetch(`/api/scandirectory/${item.id}`, { method: 'DELETE' }).then(r => r.json())
    if (res.success) await loadScanDirList()
    else alert(res.message || '删除失败')
  } catch (error) {
    alert('删除失败: ' + error.message)
  }
}

const scanDir = async (item) => {
  if (!confirm(`确定扫描目录 "${item.path}" 吗？`)) return
  try {
    const res = await videoApi.scan({ targetPath: item.path, recursive: item.recursive })
    if (res.success) {
      alert(`扫描任务已启动！任务ID: ${res.data.taskId}`)
    } else {
      alert('扫描失败：' + (res.message || '未知错误'))
    }
  } catch (error) {
    alert('扫描失败：' + error.message)
  }
}

// 视频类型管理
const loadVideoTypeList = async () => {
  try {
    const res = await fetch('/api/videotype').then(r => r.json())
    if (res.success) videoTypeList.value = res.data || []
  } catch (error) {
    console.error('加载视频类型失败:', error)
  }
}

const openAddVideoTypeDialog = () => {
  editingVideoType.value = null
  videoTypeForm.value = { name: '', extensions: '', sortOrder: 0 }
  showVideoTypeDialog.value = true
}

const openEditVideoTypeDialog = (item) => {
  editingVideoType.value = item
  videoTypeForm.value = {
    name: item.name,
    extensions: item.extensions,
    sortOrder: item.sortOrder
  }
  showVideoTypeDialog.value = true
}

const saveVideoType = async () => {
  if (!videoTypeForm.value.name) {
    alert('类型名称不能为空')
    return
  }
  saving.value = true
  try {
    let res
    if (editingVideoType.value) {
      res = await fetch(`/api/videotype/${editingVideoType.value.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(videoTypeForm.value)
      }).then(r => r.json())
    } else {
      res = await fetch('/api/videotype', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(videoTypeForm.value)
      }).then(r => r.json())
    }
    if (res.success) {
      showVideoTypeDialog.value = false
      await loadVideoTypeList()
    } else {
      alert(res.message || '保存失败')
    }
  } catch (error) {
    alert('保存失败: ' + error.message)
  } finally {
    saving.value = false
  }
}

const deleteVideoType = async (item) => {
  if (!confirm(`确定删除视频类型 "${item.name}" 吗？`)) return
  try {
    const res = await fetch(`/api/videotype/${item.id}`, { method: 'DELETE' }).then(r => r.json())
    if (res.success) await loadVideoTypeList()
    else alert(res.message || '删除失败')
  } catch (error) {
    alert('删除失败: ' + error.message)
  }
}
</script>

<style scoped>
.settings { padding: 20px; max-width: 900px; margin: 0 auto; }
h1 { margin-bottom: 24px; color: #333; }
h2 { margin-bottom: 16px; font-size: 18px; color: #555; display: flex; align-items: center; gap: 12px; }
.settings-section { background: #fff; border-radius: 8px; padding: 20px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
.setting-item { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
.setting-item label { min-width: 100px; color: #666; }
.setting-item input { flex: 1; padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; }
.save-btn { padding: 8px 16px; background: #42b883; color: #fff; border: none; border-radius: 4px; cursor: pointer; }
.save-btn:hover { background: #369870; }
.add-btn { padding: 6px 12px; background: #42b883; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 13px; }
.add-btn:hover { background: #369870; }

.scan-list, .type-list { margin-top: 12px; }
.scan-item, .type-item { display: flex; justify-content: space-between; align-items: center; padding: 12px; border: 1px solid #eee; border-radius: 6px; margin-bottom: 8px; }
.scan-info, .type-info { flex: 1; }
.scan-path { font-weight: 500; color: #333; }
.scan-meta { margin-top: 4px; display: flex; gap: 8px; }
.meta-tag { font-size: 12px; padding: 2px 6px; background: #e8f5e9; color: #2e7d32; border-radius: 3px; }
.meta-tag.disabled { background: #f5f5f5; color: #999; }
.type-name { font-weight: 500; color: #333; }
.type-ext { margin-left: 12px; color: #999; font-size: 13px; }
.scan-actions, .type-actions { display: flex; gap: 8px; }
.btn-scan, .btn-edit, .btn-delete { padding: 6px 12px; border: none; border-radius: 4px; cursor: pointer; font-size: 13px; }
.btn-scan { background: #1976d2; color: #fff; }
.btn-edit { background: #ff9800; color: #fff; }
.btn-delete { background: #d32f2f; color: #fff; }
.btn-scan:hover { background: #1565c0; }
.btn-edit:hover { background: #f57c00; }
.btn-delete:hover { background: #c62828; }

.empty-tip { color: #999; font-size: 14px; padding: 20px; text-align: center; }

.dialog-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.dialog { background: #fff; border-radius: 8px; width: 400px; max-width: 90%; }
.dialog-header { padding: 16px 20px; border-bottom: 1px solid #eee; }
.dialog-header h3 { margin: 0; font-size: 16px; }
.dialog-body { padding: 20px; }
.dialog-footer { padding: 16px 20px; border-top: 1px solid #eee; display: flex; justify-content: flex-end; gap: 12px; }
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
</style>
