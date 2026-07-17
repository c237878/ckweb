import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 0, // 无超时限制
  headers: {
    'Content-Type': 'application/json'
  }
})

// 上传专用实例 - 跳过 Vite 代理，直连后端（避免大文件断流）
// baseURL 包含 /api 前缀，因为 UploadController 路由为 api/[controller]
const LAN_IP = '192.168.110.67'
const uploadAxios = axios.create({
  baseURL: import.meta.env.DEV
    ? `http://${LAN_IP}:5033/api`
    : '/api',
  timeout: 0,
  headers: { 'Content-Type': 'multipart/form-data' }
})

// 响应拦截器：与 api 实例保持一致
uploadAxios.interceptors.response.use(
  response => response.data,
  error => {
    console.error('Upload API Error:', error)
    return Promise.reject(error)
  }
)

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
  getRecommend: (id, limit = 8) => api.get(`/video/${id}/recommend`, { params: { limit } }),
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
  getAutoCode: () => api.get('/video/autocode'),
  like: (id) => api.post(`/video/${id}/like`),
  resetFileSize: (id) => api.post(`/video/${id}/reset-file-size`),
  deleteVideoFile: (id) => api.delete(`/video/${id}/file`),
  updateFileInfo: (id, data) => api.put(`/video/${id}/file-info`, data),
  getLikeStats: (year, month) => api.get('/video/likes/stats', { params: { year, month } }),
  getDailyRecommend: (count) => api.get('/video/daily-recommend', { params: { count } }),
  getRecentlyLiked: (count) => api.get('/video/recently-liked', { params: { count } }),
  getTopLiked: (count) => api.get('/video/top-liked', { params: { count } })
}

// 演员相关API
export const actorApi = {
  getList: (params) => api.get('/actor', { params }),
  getDetail: (id) => api.get(`/actor/${id}`),
  getVideos: (id, params) => api.get(`/actor/${id}/videos`, { params }),
  getCountries: () => api.get('/actor/countries'),
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
  getCountries: () => api.get('/series/countries'),
  add: (data) => api.post('/series', data),
  update: (id, data) => api.put(`/series/${id}`, data),
  delete: (id) => api.delete(`/series/${id}`),
  getVideos: (id, params) => api.get(`/series/${id}/videos`, { params })
}

// 扫描目录相关API
export const scanDirectoryApi = {
  getList: () => api.get('/scanDirectory'),
  add: (data) => api.post('/scanDirectory', data),
  update: (id, data) => api.put(`/scanDirectory/${id}`, data),
  delete: (id) => api.delete(`/scanDirectory/${id}`),
  // 扫描单个目录（复用 videoApi.scan）
  scan: (path, recursive = true) => api.post('/video/scan-directory', { targetPath: path, recursive })
}

export const uploadApi = {
  uploadVideo: (directory, file, onProgress) => {
    const formData = new FormData()
    formData.append('directory', directory)
    formData.append('file', file)
    return uploadAxios.post('/upload/video', formData, onProgress ? { onUploadProgress: onProgress } : {})
  },
  uploadCover: (directory, file, onProgress) => {
    const formData = new FormData()
    formData.append('directory', directory)
    formData.append('file', file)
    return uploadAxios.post('/upload/cover', formData, onProgress ? { onUploadProgress: onProgress } : {})
  }
}

export const friendLinkApi = {
  getList: () => api.get('/FriendLink'),
  add: (data) => api.post('/FriendLink', data),
  update: (id, data) => api.put(`/FriendLink/${id}`, data),
  delete: (id) => api.delete(`/FriendLink/${id}`)
}

export default api
