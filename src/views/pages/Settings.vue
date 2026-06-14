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

    <!-- Samba共享管理 -->
    <div class="settings-section">
      <h2>
        Samba共享管理
        <button class="add-btn" @click="openAddSambaDialog">+ 添加共享</button>
        <button class="import-btn" @click="importSystemShares" :disabled="importing">
          {{ importing ? '导入中...' : '导入系统共享' }}
        </button>
      </h2>

      <!-- 系统共享状态提示 -->
      <div class="system-status" v-if="systemShares.length > 0">
        <span class="status-label">系统共享点：</span>
        <div class="share-chip" v-for="s in systemShares" :key="s.name"
             :class="{ active: s.smbShared }">
          <span class="chip-name">{{ s.name }}</span>
          <span class="chip-path">{{ s.path }}</span>
          <span class="chip-flags">
            <span class="flag" :class="{ on: s.smbShared }">SMB</span>
            <span class="flag" :class="{ on: s.guestAccess }">访客</span>
            <span class="flag" :class="{ on: s.readOnly }">只读</span>
          </span>
        </div>
      </div>

      <!-- 共享列表 -->
      <div class="samba-list" v-if="sambaList.length > 0">
        <div class="samba-item" v-for="item in sambaList" :key="item.id">
          <div class="samba-info">
            <div class="samba-name">
              {{ item.name }}
              <span class="samba-status-badge" :class="{ active: item.smbShared, inactive: !item.smbShared && item.systemExists }">
                {{ item.smbShared ? '已启用' : (!item.systemExists ? '未同步' : '已禁用') }}
              </span>
              <span class="samba-status-badge guest" v-if="item.guestAccess">访客</span>
              <span class="samba-status-badge readonly" v-if="item.readOnly">只读</span>
            </div>
            <div class="samba-path">{{ item.path }}</div>
          </div>
          <div class="samba-actions">
            <button class="btn-scan" @click="scanSamba(item)">扫描</button>
            <button class="btn-edit" @click="openEditSambaDialog(item)">编辑</button>
            <button class="btn-delete" @click="deleteSamba(item)">删除</button>
          </div>
        </div>
      </div>
      <div class="empty-tip" v-else>
        暂无Samba共享，点击上方按钮添加
      </div>
    </div>

    <!-- 扫描弹窗 -->
    <!-- Samba添加/编辑弹窗 -->
    <div class="dialog-overlay" v-if="showSambaDialog"
         @mousedown="handleSambaOverlayDown"
         @click="handleSambaOverlayClick">
      <div class="dialog dialog-samba">
        <div class="dialog-header">
          <h3>{{ editingSamba ? '编辑Samba共享' : '添加Samba共享' }}</h3>
        </div>
        <div class="dialog-body">
          <div class="form-group">
            <label>共享名称 *</label>
            <input v-model="sambaForm.name" placeholder="如: NAS视频库" />
          </div>
          <div class="form-group">
            <label>目录路径 *</label>
            <input v-model="sambaForm.path" placeholder="如: /Volumes/wdc4t/视频" />
          </div>
          <div class="form-group form-check">
            <label>
              <input type="checkbox" v-model="sambaForm.smbEnabled" />
              启用SMB共享
            </label>
          </div>
          <div class="form-group form-check">
            <label>
              <input type="checkbox" v-model="sambaForm.guestAccess" />
              允许访客访问
            </label>
          </div>
          <div class="form-group form-check">
            <label>
              <input type="checkbox" v-model="sambaForm.readOnly" />
              只读模式
            </label>
          </div>
        </div>
        <div class="dialog-footer">
          <button class="btn btn-cancel" @click="showSambaDialog = false">取消</button>
          <button class="btn btn-confirm" @click="saveSamba" :disabled="saving">{{ saving ? '保存中...' : '保存' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { settingApi, videoApi, sambaApi } from '@/scripts/api'

const settingsList = ref([
  { id: 'siteName', label: '网站名称', value: '', placeholder: '影视网站' }
])

const sambaList = ref([])
const systemShares = ref([])
const showSambaDialog = ref(false)
const editingSamba = ref(null)
const saving = ref(false)
const importing = ref(false)
const sambaForm = ref({
  name: '',
  path: '',
  smbEnabled: true,
  guestAccess: true,
  readOnly: false
})

// Samba弹窗点击穿透处理
let mouseDownOnSambaDialog = false
function handleSambaOverlayDown(e) {
  const dialog = e.currentTarget.querySelector('.dialog')
  mouseDownOnSambaDialog = dialog && dialog.contains(e.target)
}
function handleSambaOverlayClick() {
  if (!mouseDownOnSambaDialog) showSambaDialog.value = false
}

onMounted(async () => {
  await loadSettings()
  await loadSambaList()
})

const loadSettings = async () => {
  for (const item of settingsList.value) {
    try {
      const res = await settingApi.getByName(item.id)
      if (res.success && res.data) {
        item.value = res.data
      }
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

const loadSambaList = async () => {
  try {
    const [listRes, sysRes] = await Promise.all([
      sambaApi.getList(),
      sambaApi.getSystemShares()
    ])
    if (listRes.success) {
      sambaList.value = listRes.data || []
    }
    if (sysRes.success) {
      systemShares.value = sysRes.data || []
    }
  } catch (error) {
    console.error('加载Samba列表失败:', error)
  }
}

const importSystemShares = async () => {
  if (!confirm('确定导入系统现有的所有Samba共享到数据库吗？')) return
  
  importing.value = true
  try {
    const res = await sambaApi.importSystem()
    if (res.success) {
      alert(res.message || '导入成功')
      await loadSambaList()
    } else {
      alert('导入失败：' + (res.message || '未知错误'))
    }
  } catch (error) {
    alert('导入失败：' + error.message)
  } finally {
    importing.value = false
  }
}

const openAddSambaDialog = () => {
  editingSamba.value = null
  sambaForm.value = {
    name: '',
    path: '',
    smbEnabled: true,
    guestAccess: true,
    readOnly: false
  }
  showSambaDialog.value = true
}

const openEditSambaDialog = (item) => {
  editingSamba.value = item
  sambaForm.value = {
    name: item.name,
    path: item.path,
    smbEnabled: item.isEnabled,
    guestAccess: item.guestAccess,
    readOnly: item.readOnly
  }
  showSambaDialog.value = true
}

const saveSamba = async () => {
  if (!sambaForm.value.name || !sambaForm.value.path) {
    alert('名称和路径不能为空')
    return
  }

  saving.value = true
  try {
    let res
    const payload = {
      name: sambaForm.value.name,
      path: sambaForm.value.path,
      isEnabled: sambaForm.value.smbEnabled,
      guestAccess: sambaForm.value.guestAccess,
      readOnly: sambaForm.value.readOnly
    }

    if (editingSamba.value) {
      res = await sambaApi.update(editingSamba.value.id, payload)
    } else {
      res = await sambaApi.add(payload)
    }

    if (res.success) {
      showSambaDialog.value = false
      await loadSambaList()
    } else {
      alert(res.message || '保存失败')
    }
  } catch (error) {
    alert('保存失败: ' + error.message)
  } finally {
    saving.value = false
  }
}

const scanSamba = async (item) => {
  if (!confirm(`确定扫描 Samba 共享 "${item.name}" 的目录吗？\n\n扫描目录：${item.path}`)) return
  
  try {
    const res = await videoApi.scan({ targetPath: item.path, recursive: true })
    if (res.success) {
      alert(`扫描任务已启动！任务ID: ${res.data.taskId}`)
    } else {
      alert('扫描失败：' + (res.message || '未知错误'))
    }
  } catch (error) {
    alert('扫描失败：' + error.message)
  }
}

const deleteSamba = async (item) => {
  if (!confirm(`确定删除 "${item.name}" 吗？\n这将同时移除系统共享。`)) return

  try {
    const res = await sambaApi.delete(item.id)
    if (res.success) {
      await loadSambaList()
    } else {
      alert(res.message || '删除失败')
    }
  } catch (error) {
    alert('删除失败: ' + error.message)
  }
}

const openScanDialog = () => {
  scanDir.value = '/Volumes/wdc4t'
  showScanDialog.value = true
}

const doScan = async () => {
  if (!scanDir.value) {
    alert('请输入扫描目录')
    return
  }
  scanning.value = true
  try {
    const res = await videoApi.scan({ directory: scanDir.value })
    if (res.success) {
      alert(`扫描任务已提交，共发现 ${res.data?.count || 0} 个新视频`)
      showScanDialog.value = false
    } else {
      alert('扫描失败：' + (res.message || '未知错误'))
    }
  } catch (error) {
    alert('扫描失败：' + error.message)
  } finally {
    scanning.value = false
  }
}
</script>

<style scoped>
.settings {
  padding: 20px 0;
  max-width: 900px;
}

h1 {
  font-size: 22px;
  color: #333;
  margin-bottom: 30px;
}

.settings-section {
  margin-bottom: 30px;
}

.settings-section h2 {
  font-size: 18px;
  color: #333;
  margin-bottom: 16px;
  padding-bottom: 8px;
  border-bottom: 1px solid #eee;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.add-btn {
  font-size: 14px;
  padding: 6px 16px;
  background: #27ae60;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.add-btn:hover {
  background: #219a52;
}

.import-btn {
  font-size: 14px;
  padding: 6px 16px;
  background: #3498db;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  margin-left: 8px;
}

.import-btn:hover {
  background: #2980b9;
}

.import-btn:disabled {
  background: #bbb;
  cursor: not-allowed;
}

.setting-item {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.setting-item label {
  width: 100px;
  font-size: 14px;
  color: #666;
  flex-shrink: 0;
}

.setting-item input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.save-btn {
  padding: 8px 16px;
  background: #3498db;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  flex-shrink: 0;
}

.save-btn:hover {
  background: #2980b9;
}

/* 系统共享状态 */
.system-status {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
  padding: 12px;
  background: #f0f0f0;
  border-radius: 8px;
  align-items: center;
}

.status-label {
  font-size: 13px;
  color: #666;
  font-weight: 600;
}

.share-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  background: #fff;
  border: 1px solid #ddd;
  border-radius: 16px;
  font-size: 13px;
}

.share-chip.active {
  border-color: #27ae60;
  background: #f0fff4;
}

.chip-name {
  font-weight: 600;
  color: #333;
}

.chip-path {
  color: #888;
  font-size: 12px;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chip-flags {
  display: flex;
  gap: 4px;
}

.flag {
  font-size: 11px;
  padding: 1px 5px;
  background: #ddd;
  color: #666;
  border-radius: 8px;
}

.flag.on {
  background: #27ae60;
  color: white;
}

/* Samba列表样式 */
.samba-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.samba-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e9ecef;
}

.samba-info {
  flex: 1;
}

.samba-name {
  font-size: 16px;
  font-weight: 600;
  color: #333;
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.samba-status-badge {
  font-size: 12px;
  padding: 2px 8px;
  background: #27ae60;
  color: white;
  border-radius: 12px;
  font-weight: normal;
}

.samba-status-badge.inactive {
  background: #e74c3c;
}

.samba-status-badge.guest {
  background: #3498db;
}

.samba-status-badge.readonly {
  background: #f39c12;
}

.samba-path {
  font-size: 14px;
  color: #666;
  font-family: monospace;
  margin-bottom: 4px;
}

.samba-user {
  font-size: 13px;
  color: #888;
}

.samba-actions {
  display: flex;
  gap: 8px;
}

.btn-edit, .btn-delete, .btn-scan {
  padding: 6px 14px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}

.btn-scan {
  background: #27ae60;
  color: white;
}

.btn-scan:hover {
  background: #219a52;
}

.btn-edit {
  background: #3498db;
  color: white;
}

.btn-edit:hover {
  background: #2980b9;
}

.btn-delete {
  background: #e74c3c;
  color: white;
}

.btn-delete:hover {
  background: #c0392b;
}

.empty-tip {
  color: #999;
  font-size: 14px;
  padding: 20px;
  text-align: center;
  background: #f8f9fa;
  border-radius: 8px;
}

.scan-btn {
  padding: 10px 24px;
  background: #e74c3c;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.scan-btn:hover {
  background: #c0392b;
}

/* 弹窗样式 */
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.dialog {
  background: #fff;
  border-radius: 8px;
  width: 480px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
}

.dialog-samba {
  width: 520px;
}

.dialog-header {
  padding: 16px 20px;
  border-bottom: 1px solid #eee;
}

.dialog-header h3 {
  margin: 0;
  font-size: 18px;
}

.dialog-body {
  padding: 20px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 16px;
}

.form-group:last-child {
  margin-bottom: 0;
}

.form-group label {
  font-size: 14px;
  color: #333;
}

.form-group input {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.form-check {
  flex-direction: row;
  align-items: center;
  gap: 8px;
}

.form-check input {
  width: 18px;
  height: 18px;
}

.dialog-footer {
  padding: 16px 20px;
  border-top: 1px solid #eee;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.btn {
  padding: 8px 20px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.btn-cancel { background: #ddd; color: #333; }
.btn-confirm { background: #3498db; color: white; }
.btn-confirm:disabled { background: #bbb; cursor: not-allowed; }
</style>