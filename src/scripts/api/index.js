import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// 响应拦截器
api.interceptors.response.use(
  response => response.data,
  error => {
    console.error('API Error:', error)
    return Promise.reject(error)
  }
)

// 视频相关API
export const videoApi = {
  getList: (params) => api.get('/video/list', { params }),
  getDetail: (id) => api.get(`/video/${id}`),
  add: (data) => api.post('/video/add', data),
  update: (id, data) => api.put(`/video/${id}`, data),
  delete: (id) => api.delete(`/video/${id}`),
  scan: (data) => api.post('/video/scan', data),
  getScanStatus: (taskId) => api.get(`/video/scan/${taskId}`),
  getStreamUrl: (id) => `/api/video/stream/${id}`,
  getCoverUrl: (id) => `/api/video/cover/${id}`
}

// 演员相关API
export const actorApi = {
  getList: (params) => api.get('/actor', { params }),
  getDetail: (id) => api.get(`/actor/${id}`),
  getVideos: (id, params) => api.get(`/actor/${id}/videos`, { params }),
  add: (data) => api.post('/actor', data),
  update: (id, data) => api.put(`/actor/${id}`, data),
  delete: (id) => api.delete(`/actor/${id}`)
}

// 系统设置相关API
export const settingApi = {
  getAll: () => api.get('/systemsetting'),
  getByName: (name) => api.get(`/systemsetting/${name}`),
  save: (data) => api.post('/systemsetting', data),
  delete: (id) => api.delete(`/systemsetting/${id}`)
}

// Samba共享相关API
export const sambaApi = {
  getList: () => api.get('/samba/list'),
  getSystemShares: () => api.get('/samba/system-shares'),
  getById: (id) => api.get(`/samba/${id}`),
  add: (data) => api.post('/samba/add', data),
  update: (id, data) => api.put(`/samba/${id}`, data),
  delete: (id) => api.delete(`/samba/${id}`)
}

export default api
