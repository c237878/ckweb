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
  batchDelete: (ids) => api.delete('/video/batch', { data: { ids } }),
  scan: (data) => api.post('/video/scan-directory', data),
  scanAll: () => api.post('/video/scan'),
  getScanStatus: (taskId) => api.get(`/video/scan/${taskId}`),
  getStreamUrl: (id) => `/api/video/stream/${id}`,
  getCoverUrl: (id) => `/api/video/cover/${id}`,
  getMeta: () => api.get('/video/meta'),
  like: (id) => api.post(`/video/${id}/like`)
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

// 系列相关API
export const seriesApi = {
  getList: (params) => api.get('/series', { params }),
  getDetail: (id) => api.get(`/series/${id}`),
  add: (data) => api.post('/series', data),
  update: (id, data) => api.put(`/series/${id}`, data),
  delete: (id) => api.delete(`/series/${id}`)
}

// 扫描目录相关API
export const scanDirectoryApi = {
  getList: () => api.get('/scan-directory'),
  add: (data) => api.post('/scan-directory', data),
  update: (id, data) => api.put(`/scan-directory/${id}`, data),
  delete: (id) => api.delete(`/scan-directory/${id}`)
}

export default api
