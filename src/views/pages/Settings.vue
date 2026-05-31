<template>
  <div class="settings-page">
    <h1>系统设置</h1>
    
    <!-- 基本设置 -->
    <div class="settings-section">
      <h2>基本设置</h2>
      <div class="setting-item">
        <label>网站名称</label>
        <input v-model="settings.siteName" type="text" placeholder="请输入网站名称" />
      </div>
      <div class="setting-item">
        <label>每页显示数量</label>
        <input v-model.number="settings.pageSize" type="number" min="1" max="100" placeholder="影片列表每页显示数量" />
      </div>
      <button class="save-btn" @click="saveBasicSettings">保存设置</button>
    </div>

    <!-- 友情链接管理 -->
    <div class="settings-section">
      <h2>友情链接管理</h2>
      <button class="add-btn" @click="showAddLinkDialog = true">添加链接</button>
      
      <div class="links-list">
        <div class="link-item" v-for="link in friendLinks" :key="link.id">
          <div class="link-info">
            <span class="link-name">{{ link.name }}</span>
            <a :href="link.link" target="_blank" class="link-url">{{ link.link }}</a>
          </div>
          <div class="link-actions">
            <button class="edit-btn" @click="editLink(link)">编辑</button>
            <button class="delete-btn" @click="deleteLink(link.id)">删除</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 添加/编辑友情链接对话框 -->
    <div class="dialog-overlay" v-if="showAddLinkDialog" @click.self="closeLinkDialog">
      <div class="dialog">
        <h3>{{ editingLink ? '编辑链接' : '添加链接' }}</h3>
        <div class="form-item">
          <label>网站名称 *</label>
          <input v-model="linkForm.name" type="text" placeholder="必填" />
        </div>
        <div class="form-item">
          <label>网站链接 *</label>
          <input v-model="linkForm.link" type="url" placeholder="必填，如: https://example.com" />
        </div>
        <div class="form-item">
          <label>排序序号</label>
          <input v-model.number="linkForm.sortorder" type="number" placeholder="数字越小越靠前" />
        </div>
        <div class="dialog-actions">
          <button class="cancel-btn" @click="closeLinkDialog">取消</button>
          <button class="confirm-btn" @click="saveLink">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { settingApi, friendLinkApi } from '@/scripts/api'

const settings = ref({
  siteName: '',
  pageSize: 20
})

const friendLinks = ref([])
const showAddLinkDialog = ref(false)
const editingLink = ref(null)
const linkForm = ref({
  name: '',
  link: '',
  sortorder: 0
})

onMounted(async () => {
  await loadSettings()
  await loadFriendLinks()
})

const loadSettings = async () => {
  try {
    const res = await settingApi.getAll()
    if (res.success && res.data) {
      res.data.forEach(item => {
        if (item.name === 'siteName') {
          settings.value.siteName = item.content || ''
        } else if (item.name === 'pageSize') {
          settings.value.pageSize = parseInt(item.content) || 20
        }
      })
    }
  } catch (error) {
    console.error('加载设置失败:', error)
  }
}

const saveBasicSettings = async () => {
  try {
    const [res1, res2] = await Promise.all([
      settingApi.save({ name: 'siteName', content: settings.value.siteName }),
      settingApi.save({ name: 'pageSize', content: settings.value.pageSize.toString() })
    ])
    
    if (res1.success && res2.success) {
      alert('设置保存成功！')
      // 触发全局事件，通知其他组件更新
      window.dispatchEvent(new CustomEvent('settingsUpdated', { 
        detail: { siteName: settings.value.siteName, pageSize: settings.value.pageSize }
      }))
    } else {
      alert('部分设置保存失败')
    }
  } catch (error) {
    console.error('保存设置失败:', error)
    alert('保存失败：' + error.message)
  }
}

const loadFriendLinks = async () => {
  try {
    const res = await friendLinkApi.getList()
    if (res.success) {
      friendLinks.value = res.data
    }
  } catch (error) {
    console.error('加载友情链接失败:', error)
  }
}

const editLink = (link) => {
  editingLink.value = link
  linkForm.value = { 
    name: link.name,
    link: link.link,
    sortorder: link.sortorder || 0
  }
  showAddLinkDialog.value = true
}

const deleteLink = async (id) => {
  if (!confirm('确定要删除这个友情链接吗？')) return
  
  try {
    const res = await friendLinkApi.delete(id)
    if (res.success) {
      await loadFriendLinks()
    } else {
      alert('删除失败：' + res.message)
    }
  } catch (error) {
    console.error('删除链接失败:', error)
    alert('删除失败：' + error.message)
  }
}

const closeLinkDialog = () => {
  showAddLinkDialog.value = false
  editingLink.value = null
  linkForm.value = {
    name: '',
    link: '',
    sortorder: 0
  }
}

const saveLink = async () => {
  if (!linkForm.value.name || !linkForm.value.link) {
    alert('请填写网站名称和链接')
    return
  }

  try {
    let res
    if (editingLink.value) {
      res = await friendLinkApi.update(editingLink.value.id, linkForm.value)
    } else {
      res = await friendLinkApi.add(linkForm.value)
    }

    if (res.success) {
      await loadFriendLinks()
      closeLinkDialog()
    } else {
      alert('保存失败：' + res.message)
    }
  } catch (error) {
    console.error('保存链接失败:', error)
    alert('保存失败：' + error.message)
  }
}
</script>

<style scoped>
.settings-page {
  padding: 20px 0;
  max-width: 900px;
  margin: 0 auto;
}

h1 {
  margin-bottom: 30px;
}

.settings-section {
  background: #fff;
  padding: 25px;
  border-radius: 8px;
  margin-bottom: 30px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.settings-section h2 {
  margin-bottom: 20px;
  padding-bottom: 10px;
  border-bottom: 2px solid #e74c3c;
}

.setting-item {
  margin-bottom: 20px;
}

.setting-item label {
  display: block;
  margin-bottom: 8px;
  font-weight: bold;
  color: #333;
}

.setting-item input {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.save-btn,
.add-btn {
  padding: 10px 30px;
  background: #e74c3c;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: background 0.3s;
}

.save-btn:hover,
.add-btn:hover {
  background: #c0392b;
}

.add-btn {
  margin-bottom: 20px;
}

.links-list {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.link-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px;
  background: #f9f9f9;
  border-radius: 4px;
  border: 1px solid #eee;
}

.link-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.link-name {
  font-weight: bold;
  font-size: 16px;
}

.link-url {
  color: #3498db;
  font-size: 14px;
}

.link-actions {
  display: flex;
  gap: 10px;
}

.edit-btn,
.delete-btn {
  padding: 6px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}

.edit-btn {
  background: #3498db;
  color: white;
}

.delete-btn {
  background: #e74c3c;
  color: white;
}

/* 对话框样式 */
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.dialog {
  background: white;
  padding: 30px;
  border-radius: 8px;
  width: 90%;
  max-width: 500px;
  max-height: 80vh;
  overflow-y: auto;
}

.dialog h3 {
  margin-bottom: 20px;
}

.form-item {
  margin-bottom: 20px;
}

.form-item label {
  display: block;
  margin-bottom: 8px;
  font-weight: bold;
}

.form-item input,
.form-item textarea {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 15px;
  margin-top: 20px;
}

.cancel-btn,
.confirm-btn {
  padding: 10px 25px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.cancel-btn {
  background: #95a5a6;
  color: white;
}

.confirm-btn {
  background: #e74c3c;
  color: white;
}

@media (max-width: 768px) {
  .link-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 15px;
  }
  
  .link-actions {
    width: 100%;
    justify-content: flex-end;
  }
}
</style>
