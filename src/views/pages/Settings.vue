<template>
  <div class="settings">
    <h1>系统设置</h1>
    <div class="settings-section">
      <h2>基本信息</h2>
      <div class="setting-item" v-for="item in settingsList" :key="item.id">
        <label>{{ item.label }}</label>
        <input v-model="item.value" :placeholder="item.placeholder" />
        <button class="save-btn" @click="saveSetting(item)">保存</button>
      </div>
    </div>
    <div class="settings-section">
      <h2>数据管理</h2>
      <button class="scan-btn" @click="openScanDialog">扫描视频目录</button>
    </div>

    <!-- 扫描弹窗 -->
    <div class="dialog-overlay" v-if="showScanDialog"
         @mousedown="handleOverlayDown"
         @click="handleOverlayClick">
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
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { settingApi, videoApi } from '@/scripts/api'

const settingsList = ref([
  { id: 'siteName', label: '网站名称', value: '', placeholder: '影视网站' }
])

const showScanDialog = ref(false)
const scanDir = ref('')
const scanning = ref(false)

let mouseDownOnDialog = false
function handleOverlayDown(e) {
  const dialog = e.currentTarget.querySelector('.dialog')
  mouseDownOnDialog = dialog && dialog.contains(e.target)
}
function handleOverlayClick() {
  if (!mouseDownOnDialog) showScanDialog.value = false
}

onMounted(async () => {
  await loadSettings()
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
      // 触发全局事件更新网站名称
      window.dispatchEvent(new CustomEvent('settingsUpdated', { detail: { siteName: item.value } }))
    }
  } catch (error) {
    console.error('保存失败:', error)
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
