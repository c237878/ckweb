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

    <!-- Samba管理 -->
    <div class="settings-section">
      <h2>
        Samba共享管理
        <button class="add-btn" @click="openAddSambaDialog">+ 添加</button>
      </h2>
      <div class="samba-list" v-if="sambaList.length > 0">
        <div class="samba-item" v-for="item in sambaList" :key="item.id">
          <div class="samba-info">
            <div class="samba-name">
              {{ item.name }}
              <span class="samba-status" :class="{ disabled: !item.isEnabled }">
                {{ item.isEnabled ? '已启用' : '已禁用' }}
              </span>
            </div>
            <div class="samba-path">{{ item.path }}</div>
            <div class="samba-user" v-if="item.username">用户: {{ item.username }}</div>
          </div>
          <div class="samba-actions">
            <button class="btn-edit" @click="openEditSambaDialog(item)">编辑</button>
            <button class="btn-delete" @click="deleteSamba(item)">删除</button>
          </div>
        </div>
      </div>
      <div class="empty-tip" v-else>暂无Samba共享，点击上方按钮添加</div>
    </div>

    <!-- 数据管理 -->
    <div class="settings-section">
      <h2>数据管理</h2>
      <button class="scan-btn" @click="openScanDialog">扫描视频目录</button>
    </div>

    <!-- 扫描弹窗 -->
    <div class="dialog-overlay" v-if="showScanDialog"
         @mousedown="handleScanOverlayDown"
         @click="handleScanOverlayClick">
      <div class="dialog">
        <div class="dialog-header"><h3>扫描视频目录</h3></div>
        <div class="dialog-body">
          <div class="form-group">
            <label>扫描目录路径</label>
            <input v-model="scanDir" placeholder="/Volumes/wdc4t/视频" />
          </div>
        </div>
        <div class="dialog-footer">
          <button class="btn btn-cancel" @click="showScanDialog = false">取消</button>
          <button class="btn btn-confirm" @click="doScan" :disabled="scanning">开始扫描</button>
        </div>
      </div>
    </div>

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
            <label>名称 *</label>
            <input v-model="sambaForm.name" placeholder="如: NAS视频库" />
          </div>
          <div class="form-group">
            <label>路径 *</label>
            <input v-model="sambaForm.path" placeholder="如: smb://192.168.1.100/video" />
          </div>
          <div class="form-group">
            <label>用户名</label>
            <input v-model="sambaForm.username" placeholder="可选" />
          </div>
          <div class="form-group">
            <label>密码</label>
            <input v-model="sambaForm.password" type="password" placeholder="可选" />
          </div>
          <div class="form-group">
            <label>域</label>
            <input v-model="sambaForm.domain" placeholder="可选" />
          </div>
          <div class="form-group form-check">
            <label>
              <input type="checkbox" v-model="sambaForm.isEnabled" />
              启用此共享
            </label>
          </div>
        </div>
        <div class="dialog-footer">
          <button class="btn btn-cancel" @click="showSambaDialog = false">取消</button>
          <button class="btn btn-confirm" @click="saveSamba" :disabled="saving">保存</button>
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

const showScanDialog = ref(false)
const scanDir = ref('')
const scanning = ref(false)

const sambaList = ref([])
const showSambaDialog = ref(false)
const editingSamba = ref(null)
const saving = ref(false)
const sambaForm = ref({
  name: '',
  path: '',
  username: '',
  password: '',
  domain: '',
  isEnabled: true
})

// 扫描弹窗点击穿透处理
let mouseDownOnScanDialog = false
function handleScanOverlayDown(e) {
  const dialog = e.currentTarget.querySelector('.dialog')
  mouseDownOnScanDialog = dialog && dialog.contains(e.target)
}
function handleScanOverlayClick() {
  if (!mouseDownOnScanDialog) showScanDialog.value = false
}

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
    const res = await sambaApi.getList()
    if (res.success) {
      sambaList.value = res.data || []
    }
  } catch (error) {
    console.error('加载Samba列表失败:', error)
  }
}

const openAddSambaDialog = () => {
  editingSamba.value = null
  sambaForm.value = {
    name: '',
    path: '',
    username: '',
    password: '',
    domain: '',
    isEnabled: true
  }
  showSambaDialog.value = true
}

const openEditSambaDialog = (item) => {
  editingSamba.value = item
  sambaForm.value = {
    name: item.name,
    path: item.path,
    username: item.username || '',
    password: '',
    domain: item.domain || '',
    isEnabled: item.isEnabled
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
    if (editingSamba.value) {
      res = await sambaApi.update(editingSamba.value.id, sambaForm.value)
    } else {
      res = await sambaApi.add(sambaForm.value)
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

const deleteSamba = async (item) => {
  if (!confirm(`确定删除 "${item.name}" 吗?`)) return

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
  max-width: 800px;
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
}

.samba-status {
  font-size: 12px;
  padding: 2px 8px;
  background: #27ae60;
  color: white;
  border-radius: 12px;
  font-weight: normal;
}

.samba-status.disabled {
  background: #95a5a6;
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

.btn-edit, .btn-delete {
  padding: 6px 14px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
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
