import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
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
 // 获取视频列表
  getList: (params) => api.get('/video/list', { params }),
  // 获取视频详情
  getDetail: (id) => api.get(`/video/${id}`),
  // 手动添加视频
  add: (data) => api.post('/video/add', data),
  // 更新视频
  update: (id, data) => api.put(`/video/${id}`, data),
  // 删除视频
  delete: (id) => api.delete(`/video/${id}`),
  // 扫描目录
  scan: (data) => api.post('/video/scan', data),
  // 获取扫描状态
  getScanStatus: (taskId) => api.get(`/video/scan/${taskId}`),
  // 视频流（直接跳转，不走 axios）
  getStreamUrl: (id) => `/api/video/stream/${id}`,
  // 封面URL（直接跳转，不走 axios）
  getCoverUrl: (id) => `/api/video/cover/${id}`
}

// 演员相关API
export const actorApi = {
  // 获取演员列表
  getList: (params) => api.get('/actor', { params }),
  // 获取演员详情
  getDetail: (id) => api.get(`/actor/${id}`),
  // 获取演员的影片
  getVideos: (id, params) => api.get(`/actor/${id}/videos`, { params }),
  // 添加演员
  add: (data) => api.post('/actor', data),
  // 更新演员
  update: (id, data) => api.put(`/actor/${id}`, data),
  // 删除演员
  delete: (id) => api.delete(`/actor/${id}`)
}

// 系列相关API
export const seriesApi = {
  // 获取系列列表
  getList: (params) => api.get('/series', { params }),
  // 获取系列详情
  getDetail: (id) => api.get(`/series/${id}`),
  // 获取系列下的影片
  getVideos: (id, params) => api.get(`/series/${id}/videos`, { params }),
  // 添加系列
  add: (data) => api.post('/series', data),
  // 更新系列
  update: (id, data) => api.put(`/series/${id}`, data),
  // 删除系列
  delete: (id) => api.delete(`/series/${id}`)
}

// 视频-演员关联API
export const videoActorApi = {
  // 获取视频的演员列表
  getActorsByVideo: (videoId) => api.get(`/videoactor/video/${videoId}`),
  // 获取演员的视频列表
  getVideosByActor: (actorId) => api.get(`/videoactor/actor/${actorId}`),
  // 添加关联
  addRelation: (data) => api.post('/videoactor', data),
  // 删除关联
  deleteRelation: (id) => api.delete(`/videoactor/${id}`),
  // 删除视频的所有演员关联
  deleteByVideo: (videoId) => api.delete(`/videoactor/video/${videoId}`),
  // 批量设置视频的演员
  setVideoActors: (videoId, actorIds) => api.post(`/videoactor/video/${videoId}/actors`, actorIds)
}

// 点赞相关API
export const likeApi = {
  // 点赞
  like: (videoId, userToken) => api.post(`/like/${videoId}`, null, { params: { userToken } }),
  // 取消点赞
  unlike: (videoId, userToken) => api.delete(`/like/${videoId}`, { params: { userToken } }),
  // 获取点赞数
  getCount: (videoId) => api.get(`/like/count/${videoId}`),
  // 检查是否已点赞
  checkLiked: (videoId, userToken) => api.get(`/like/check/${videoId}`, { params: { userToken } })
}

// 精彩集锦相关API
export const highlightApi = {
  // 获取集锦列表
  getList: (params) => api.get('/highlight', { params }),
  // 获取集锦详情
  getDetail: (id) => api.get(`/highlight/${id}`),
  // 添加集锦
  add: (data) => api.post('/highlight', data),
  // 更新集锦
  update: (id, data) => api.put(`/highlight/${id}`, data),
  // 删除集锦
  delete: (id) => api.delete(`/highlight/${id}`)
}

// 系统设置相关API
export const settingApi = {
  // 获取所有设置
  getAll: () => api.get('/systemsetting'),
  // 根据名称获取设置
  getByName: (name) => api.get(`/systemsetting/${name}`),
  // 保存设置
  save: (data) => api.post('/systemsetting', data),
  // 删除设置
  delete: (id) => api.delete(`/systemsetting/${id}`)
}

// 友情链接相关API
export const friendLinkApi = {
  // 获取链接列表
  getList: () => api.get('/friendlink'),
  // 添加链接
  add: (data) => api.post('/friendlink', data),
  // 更新链接
  update: (id, data) => api.put(`/friendlink/${id}`, data),
  // 删除链接
  delete: (id) => api.delete(`/friendlink/${id}`)
}

export default api
